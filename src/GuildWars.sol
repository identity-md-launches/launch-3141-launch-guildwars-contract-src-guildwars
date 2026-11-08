// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GuildWars
/// @notice Registry for "Squeek Guild Wars", an unofficial community game for Squeekchain (Sepolia testnet).
/// Wallets form guilds, check in once per UTC day and guilds are scored by the AVERAGE of their members'
/// season points. This contract never holds SQK, ETH or NFTs, has no owner, no admin, no pause and no proxy.
/// Its only external calls are two guarded read-only calls to the official SqueekMining and SqueekStaking
/// contracts; if either read fails the check-in still succeeds without the matching bonus.

interface ISqueekMining {
    function checkpointStatus() external view returns (bool corePaused, uint64 nextRound, bool roundSettled);
}

interface ISqueekStaking {
    function accountPower(address account) external view returns (uint256 nftPower, uint256 sqkPower);
    function stakeOf(address account)
        external
        view
        returns (uint256 principal, uint256 freshPrincipal, uint64 freshUntilRound);
}

contract GuildWars {
    // ---------------------------------------------------------------- constants
    uint256 public constant MIN_SEATS = 5;
    uint256 public constant MAX_SEATS = 20;
    uint256 public constant MAX_NAME_LENGTH = 24;
    uint32 public constant INACTIVITY_DAYS = 14;
    uint64 public constant LEAVE_COOLDOWN = 1 days;
    uint256 public constant BASE_POINTS = 10;
    uint256 public constant MAX_POINTS = 25;
    uint32 public constant WIN_TIER_POINTS = 300;
    uint32 public constant TIE_TIER_POINTS = 150;
    uint256 public constant SCORE_SCALE = 1e6;
    uint256 private constant READ_GAS = 100_000;

    // ---------------------------------------------------------------- immutables
    address public immutable mining;
    address public immutable staking;
    /// @notice Minimum SQK staking power for the fixed x1.25 staker bonus.
    uint256 public immutable minStakerPower;

    // ---------------------------------------------------------------- storage
    struct Guild {
        address captain;
        uint8 seats;
        bool recruiting;
        uint16 memberCount;
        uint32 tierPoints;
        uint32 captainActiveDay;
        bytes32 codeHash;
        string name;
    }

    struct Member {
        uint256 guildId;
        uint32 joinedDay;
        uint32 lastCheckInDay;
        uint32 streak;
        uint64 lastRound;
        bool roundKnown;
        bool lookingForGuild;
        uint64 cooldownUntil;
    }

    uint256 public guildCount;
    mapping(uint256 => Guild) private _guilds;
    mapping(address => Member) public members;

    // per season data
    mapping(address => mapping(uint256 => uint32)) public memberSeasonPoints; // wallet => season => points earned in current guild
    mapping(uint256 => mapping(uint256 => uint256)) public guildSeasonTotal; // guild => season => total points
    mapping(uint256 => mapping(uint256 => uint16)) public guildSeasonMembers; // guild => season => member count
    mapping(uint256 => mapping(uint256 => uint8)) public guildSeasonTier; // guild => season => tier snapshot
    mapping(uint256 => mapping(uint256 => bool)) public guildSeasonTouched;
    mapping(uint256 => mapping(uint256 => bool)) public warDone; // season => guild => settled

    // ---------------------------------------------------------------- events
    event GuildCreated(uint256 indexed guildId, address indexed captain, string name, uint8 seats);
    event Joined(uint256 indexed guildId, address indexed wallet);
    event Left(uint256 indexed guildId, address indexed wallet);
    event Kicked(uint256 indexed guildId, address indexed wallet, address indexed by);
    event CaptainChanged(uint256 indexed guildId, address indexed captain);
    event RecruitingChanged(uint256 indexed guildId, bool recruiting);
    event CodeChanged(uint256 indexed guildId);
    event LookingForGuild(address indexed wallet, bool looking);
    /// @dev flags bit0 = round bonus x2, bit1 = staker bonus x1.25
    event CheckedIn(
        uint256 indexed guildId,
        address indexed wallet,
        uint256 season,
        uint256 points,
        uint64 nextRound,
        uint8 flags,
        uint32 streak
    );
    event WarResult(
        uint256 indexed season,
        uint256 indexed guildA,
        uint256 indexed guildB,
        uint256 scoreA,
        uint256 scoreB,
        uint256 winner
    );

    // ---------------------------------------------------------------- constructor
    /// @dev The constructor only rejects the zero address. It does not require code at either address: the
    /// launch rehearses constructors on an empty chain where the official proxies do not exist, and the live
    /// contracts are checked on first use anyway (a codeless or misbehaving target simply means "no bonus").
    constructor(address mining_, address staking_, uint256 minStakerPower_) {
        require(mining_ != address(0), "bad mining");
        require(staking_ != address(0), "bad staking");
        mining = mining_;
        staking = staking_;
        minStakerPower = minStakerPower_;
    }

    // ---------------------------------------------------------------- time helpers
    function _day() internal view returns (uint32) {
        return uint32(block.timestamp / 1 days);
    }

    /// @notice Season id = week number, weeks start on Monday 00:00 UTC (the Unix epoch was a Thursday).
    function currentSeason() public view returns (uint256) {
        return (block.timestamp / 1 days + 3) / 7;
    }

    function tierOf(uint32 tierPoints) public pure returns (uint8) {
        if (tierPoints >= 6000) return 3; // Legend
        if (tierPoints >= 3000) return 2; // Gold
        if (tierPoints >= 1000) return 1; // Silver
        return 0; // Bronze
    }

    // ---------------------------------------------------------------- guild management
    function createGuild(string calldata name, uint8 seats, bytes32 codeHash) external returns (uint256 guildId) {
        require(members[msg.sender].guildId == 0, "already in a guild");
        require(block.timestamp >= members[msg.sender].cooldownUntil, "cool-down");
        require(seats >= MIN_SEATS && seats <= MAX_SEATS, "seats 5-20");
        _validateName(name);

        guildId = ++guildCount;
        uint32 day = _day();
        Guild storage g = _guilds[guildId];
        g.captain = msg.sender;
        g.seats = seats;
        g.recruiting = true;
        g.codeHash = codeHash;
        g.name = name;
        g.captainActiveDay = day;

        _addMember(guildId, msg.sender, day);
        emit GuildCreated(guildId, msg.sender, name, seats);
    }

    function join(uint256 guildId, string calldata code) external {
        require(members[msg.sender].guildId == 0, "already in a guild");
        require(block.timestamp >= members[msg.sender].cooldownUntil, "cool-down");
        Guild storage g = _guilds[guildId];
        require(g.captain != address(0), "no such guild");
        require(g.recruiting, "not recruiting");
        require(g.memberCount < g.seats, "guild full");
        require(keccak256(bytes(code)) == g.codeHash, "wrong code");
        _addMember(guildId, msg.sender, _day());
        emit Joined(guildId, msg.sender);
    }

    function leave() external {
        Member storage m = members[msg.sender];
        uint256 guildId = m.guildId;
        require(guildId != 0, "not in a guild");
        Guild storage g = _guilds[guildId];
        require(msg.sender != g.captain || g.memberCount == 1, "transfer captain first");
        _removeMember(guildId, msg.sender);
        m.cooldownUntil = uint64(block.timestamp) + LEAVE_COOLDOWN;
        if (g.memberCount == 0) {
            g.captain = address(0);
            g.recruiting = false;
            emit RecruitingChanged(guildId, false);
        }
        emit Left(guildId, msg.sender);
    }

    function kick(address wallet) external {
        uint256 guildId = members[msg.sender].guildId;
        require(guildId != 0 && msg.sender == _guilds[guildId].captain, "not captain");
        require(wallet != msg.sender, "cannot kick yourself");
        require(members[wallet].guildId == guildId, "not a member");
        _removeMember(guildId, wallet);
        emit Kicked(guildId, wallet, msg.sender);
    }

    /// @notice Anyone may remove a member (never the captain) who has not checked in for 14 days.
    function removeInactive(address wallet) external {
        Member storage m = members[wallet];
        uint256 guildId = m.guildId;
        require(guildId != 0, "not in a guild");
        require(wallet != _guilds[guildId].captain, "captain");
        uint32 last = m.lastCheckInDay > m.joinedDay ? m.lastCheckInDay : m.joinedDay;
        require(_day() >= last + INACTIVITY_DAYS, "still active");
        _removeMember(guildId, wallet);
        emit Kicked(guildId, wallet, msg.sender);
    }

    function transferCaptain(address to) external {
        uint256 guildId = members[msg.sender].guildId;
        Guild storage g = _guilds[guildId];
        require(guildId != 0 && msg.sender == g.captain, "not captain");
        require(to != msg.sender && members[to].guildId == guildId, "not a member");
        g.captain = to;
        g.captainActiveDay = _day();
        emit CaptainChanged(guildId, to);
    }

    /// @notice A member may take over a guild whose captain has not checked in for 14 days.
    function claimCaptain() external {
        uint256 guildId = members[msg.sender].guildId;
        require(guildId != 0, "not in a guild");
        Guild storage g = _guilds[guildId];
        require(msg.sender != g.captain, "already captain");
        require(_day() >= g.captainActiveDay + INACTIVITY_DAYS, "captain active");
        g.captain = msg.sender;
        g.captainActiveDay = _day();
        emit CaptainChanged(guildId, msg.sender);
    }

    function setRecruiting(bool recruiting) external {
        uint256 guildId = members[msg.sender].guildId;
        require(guildId != 0 && msg.sender == _guilds[guildId].captain, "not captain");
        _guilds[guildId].recruiting = recruiting;
        emit RecruitingChanged(guildId, recruiting);
    }

    function setInviteCode(bytes32 codeHash) external {
        uint256 guildId = members[msg.sender].guildId;
        require(guildId != 0 && msg.sender == _guilds[guildId].captain, "not captain");
        _guilds[guildId].codeHash = codeHash;
        emit CodeChanged(guildId);
    }

    function setLookingForGuild(bool looking) external {
        members[msg.sender].lookingForGuild = looking;
        emit LookingForGuild(msg.sender, looking);
    }

    // ---------------------------------------------------------------- daily check-in
    function checkIn() external returns (uint256 points) {
        Member storage m = members[msg.sender];
        require(m.guildId != 0, "not in a guild");
        uint32 day = _day();
        require(m.lastCheckInDay < day, "already checked in today");

        uint64 nextRound;
        uint8 flags;
        (points, nextRound, flags) = _computePoints(m, msg.sender);
        _record(m, day, points, nextRound, flags);
    }

    /// @dev flags bit0 = round bonus (x2), bit1 = staker bonus (x1.25).
    function _computePoints(Member storage m, address wallet)
        internal
        returns (uint256 points, uint64 nextRound, uint8 flags)
    {
        (bool roundOk, uint64 round) = _readRound();
        nextRound = round;
        if (roundOk && m.roundKnown && round > m.lastRound) flags |= 1;
        if (roundOk) {
            m.lastRound = round;
            m.roundKnown = true;
        }
        if (_isStaker(wallet, roundOk ? round : 0)) flags |= 2;

        uint256 p = BASE_POINTS * 100;
        if (flags & 1 != 0) p *= 2;
        if (flags & 2 != 0) p = (p * 125) / 100;
        points = p / 100; // 10, 12, 20 or 25
        if (points > MAX_POINTS) points = MAX_POINTS;
    }

    function _record(Member storage m, uint32 day, uint256 points, uint64 nextRound, uint8 flags) internal {
        uint256 guildId = m.guildId;
        m.streak = (m.lastCheckInDay != 0 && m.lastCheckInDay + 1 == day) ? m.streak + 1 : 1;
        m.lastCheckInDay = day;

        uint256 season = currentSeason();
        memberSeasonPoints[msg.sender][season] += uint32(points);
        guildSeasonTotal[guildId][season] += points;
        if (msg.sender == _guilds[guildId].captain) _guilds[guildId].captainActiveDay = day;
        _touch(guildId, season);

        emit CheckedIn(guildId, msg.sender, season, points, nextRound, flags, m.streak);
    }

    // ---------------------------------------------------------------- wars
    /// @notice Settle one pairing after a season ended. The contract only VERIFIES the pairing: the caller
    /// must be the captain of one of the two guilds, both guilds must have been active in that season, in the
    /// same tier snapshot, and not yet settled. Winner (higher average) +300 tier points, loser +0 (never loses
    /// points), tie +150 each. Known limitation: captains choose their opponent inside their tier, so two
    /// cooperating guilds can farm tier points; tier points are cosmetic and carry no monetary value.
    function submitWar(uint256 season, uint256 guildA, uint256 guildB) external {
        require(season < currentSeason(), "season not over");
        require(guildA != guildB, "same guild");
        require(
            msg.sender == _guilds[guildA].captain || msg.sender == _guilds[guildB].captain,
            "not a captain of these guilds"
        );
        _requireEligible(season, guildA);
        _requireEligible(season, guildB);
        require(guildSeasonTier[guildA][season] == guildSeasonTier[guildB][season], "tier mismatch");

        uint256 scoreA = (guildSeasonTotal[guildA][season] * SCORE_SCALE) / guildSeasonMembers[guildA][season];
        uint256 scoreB = (guildSeasonTotal[guildB][season] * SCORE_SCALE) / guildSeasonMembers[guildB][season];
        warDone[season][guildA] = true;
        warDone[season][guildB] = true;

        uint256 winner;
        if (scoreA > scoreB) {
            _guilds[guildA].tierPoints += WIN_TIER_POINTS;
            winner = guildA;
        } else if (scoreB > scoreA) {
            _guilds[guildB].tierPoints += WIN_TIER_POINTS;
            winner = guildB;
        } else {
            _guilds[guildA].tierPoints += TIE_TIER_POINTS;
            _guilds[guildB].tierPoints += TIE_TIER_POINTS;
        }
        emit WarResult(season, guildA, guildB, scoreA, scoreB, winner);
    }

    function _requireEligible(uint256 season, uint256 guildId) internal view {
        // A guild is eligible only if at least one of its members checked in during that season.
        require(
            guildSeasonMembers[guildId][season] > 0 && guildSeasonTotal[guildId][season] > 0,
            "guild inactive that season"
        );
        require(!warDone[season][guildId], "already settled");
    }

    // ---------------------------------------------------------------- views
    function getGuild(uint256 guildId)
        external
        view
        returns (
            address captain,
            string memory name,
            uint8 seats,
            bool recruiting,
            uint16 memberCount,
            uint32 tierPoints,
            uint8 tier,
            uint32 captainActiveDay
        )
    {
        Guild storage g = _guilds[guildId];
        return (
            g.captain,
            g.name,
            g.seats,
            g.recruiting,
            g.memberCount,
            g.tierPoints,
            tierOf(g.tierPoints),
            g.captainActiveDay
        );
    }

    /// @return total season points of the guild, member count recorded for that season and the average scaled by 1e6
    function seasonScore(uint256 guildId, uint256 season)
        external
        view
        returns (uint256 total, uint16 memberCount, uint256 averageScaled)
    {
        total = guildSeasonTotal[guildId][season];
        memberCount = guildSeasonMembers[guildId][season];
        averageScaled = memberCount == 0 ? 0 : (total * SCORE_SCALE) / memberCount;
    }

    // ---------------------------------------------------------------- internals
    function _addMember(uint256 guildId, address wallet, uint32 day) internal {
        Member storage m = members[wallet];
        m.guildId = guildId;
        m.joinedDay = day;
        _guilds[guildId].memberCount += 1;
        _touch(guildId, currentSeason());
    }

    function _removeMember(uint256 guildId, address wallet) internal {
        uint256 season = currentSeason();
        uint32 pts = memberSeasonPoints[wallet][season];
        if (pts != 0) {
            guildSeasonTotal[guildId][season] -= pts;
            memberSeasonPoints[wallet][season] = 0;
        }
        _guilds[guildId].memberCount -= 1;
        members[wallet].guildId = 0;
        _touch(guildId, season);
    }

    /// @dev Snapshots the guild's tier at its first activity of a season and keeps the season member count current.
    function _touch(uint256 guildId, uint256 season) internal {
        Guild storage g = _guilds[guildId];
        if (!guildSeasonTouched[guildId][season]) {
            guildSeasonTouched[guildId][season] = true;
            guildSeasonTier[guildId][season] = tierOf(g.tierPoints);
        }
        guildSeasonMembers[guildId][season] = g.memberCount;
    }

    function _validateName(string calldata name) internal pure {
        bytes memory b = bytes(name);
        require(b.length >= 1 && b.length <= MAX_NAME_LENGTH, "name length");
        for (uint256 i = 0; i < b.length; i++) {
            bytes1 c = b[i];
            bool ok = (c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A) || c == 0x20
                || c == 0x2D;
            require(ok, "bad character");
        }
    }

    /// @dev Guarded read: never reverts, whatever the target does.
    function _readRound() internal view returns (bool ok, uint64 nextRound) {
        (bool success, bytes memory ret) =
            mining.staticcall{gas: READ_GAS}(abi.encodeWithSelector(ISqueekMining.checkpointStatus.selector));
        if (!success || ret.length < 96) return (false, 0);
        // Decode all three words as uint256: decoding a `bool` reverts on any word other than 0/1, which
        // would turn a malformed read into a revert of every check-in instead of "no bonus".
        (, uint256 n,) = abi.decode(ret, (uint256, uint256, uint256));
        if (n > type(uint64).max) return (false, 0);
        return (true, uint64(n));
    }

    /// @dev Staker bonus: SQK power at or above the threshold, ignoring the still-fresh share of the stake so
    /// that staking right before a check-in does not count. Any failed read means no bonus.
    function _isStaker(address wallet, uint256 nextRound) internal view returns (bool) {
        (bool s1, bytes memory r1) =
            staking.staticcall{gas: READ_GAS}(abi.encodeWithSelector(ISqueekStaking.accountPower.selector, wallet));
        if (!s1 || r1.length < 64) return false;
        (, uint256 sqkPower) = abi.decode(r1, (uint256, uint256));
        if (sqkPower < minStakerPower) return false;

        (bool s2, bytes memory r2) =
            staking.staticcall{gas: READ_GAS}(abi.encodeWithSelector(ISqueekStaking.stakeOf.selector, wallet));
        if (!s2 || r2.length < 96) return false;
        (uint256 principal, uint256 fresh, uint256 freshUntil) = abi.decode(r2, (uint256, uint256, uint256));

        uint256 effective = sqkPower;
        if (fresh > 0 && freshUntil > nextRound) {
            effective = fresh >= principal ? 0 : (sqkPower * (principal - fresh)) / principal;
        }
        return effective >= minStakerPower;
    }
}
