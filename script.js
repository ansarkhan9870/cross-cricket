const SUPABASE_URL = "https://zgenbnkzoxxacrrsjibj.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_zHZKaQ7Lpkrzbt7_Ebh-vQ_zfIUX3Aj";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

let savedPlayers = [];
let savedMatches = [];
let savedResults = [];
let savedStats = [];

let currentUser = null;
let isAdmin = false;


/* =========================
   HELPERS
========================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getAllPlayers() {
    return [...savedPlayers].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
    );
}

function getPlayerNames(match) {
    if (!match) return [];

    if (match.type === "single") {
        return [
            match.player_a,
            match.player_b
        ].filter(Boolean);
    }

    return [
        ...(Array.isArray(match.team_a) ? match.team_a : []),
        ...(Array.isArray(match.team_b) ? match.team_b : [])
    ].filter(Boolean);
}

function getTeamDisplay(match, team) {
    if (!match) return "";

    if (match.type === "single") {
        if (team === "A") {
            return match.player_a || "TBD";
        }

        return match.player_b || "TBD";
    }

    const players =
        team === "A"
            ? match.team_a
            : match.team_b;

    if (!Array.isArray(players) || players.length === 0) {
        return "TBD";
    }

    return players.join(" & ");
}


/* =========================
   DATABASE
========================= */

async function loadDatabase() {
    try {
        const [
            playersResponse,
            matchesResponse,
            resultsResponse,
            statsResponse
        ] = await Promise.all([
            supabaseClient
                .from("players")
                .select("*")
                .order("name", { ascending: true }),

            supabaseClient
                .from("matches")
                .select("*")
                .order("date", { ascending: true })
                .order("time", { ascending: true }),

            supabaseClient
                .from("results")
                .select("*")
                .order("created_at", { ascending: false }),

            supabaseClient
                .from("stats")
                .select("*")
                .order("player", { ascending: true })
        ]);

        if (playersResponse.error) {
            throw playersResponse.error;
        }

        if (matchesResponse.error) {
            throw matchesResponse.error;
        }

        if (resultsResponse.error) {
            throw resultsResponse.error;
        }

        if (statsResponse.error) {
            throw statsResponse.error;
        }

        savedPlayers = playersResponse.data || [];
        savedMatches = matchesResponse.data || [];
        savedResults = resultsResponse.data || [];
        savedStats = statsResponse.data || [];

        renderEverything();

    } catch (error) {
        console.error("Database loading error:", error);
        showDatabaseError(error.message);
    }
}

function showDatabaseError(message) {
    const errorHTML = `
        <div class="empty-card">
            <h3>Database Error</h3>
            <p>${escapeHTML(message)}</p>
        </div>
    `;

    const containers = [
        "todayMatchesContainer",
        "tomorrowMatchesContainer",
        "playersContainer"
    ];

    containers.forEach((id) => {
        const element = document.getElementById(id);

        if (element) {
            element.innerHTML = errorHTML;
        }
    });
}


/* =========================
   RENDER EVERYTHING
========================= */

function renderEverything() {
    loadAllPlayerDropdowns();
    renderMatches();
    renderSingleDoubleWickets();
    renderFullSchedule();
    renderResults();
    renderTopStatistics();
    renderPlayers();
    loadMatchOptions();
}


/* =========================
   PLAYER DROPDOWNS
========================= */

function fillPlayerSelect(
    selectId,
    placeholder = "Select Player"
) {
    const select = document.getElementById(selectId);

    if (!select) return;

    const currentValue = select.value;

    select.innerHTML = "";

    const placeholderOption =
        document.createElement("option");

    placeholderOption.value = "";
    placeholderOption.textContent = placeholder;

    select.appendChild(placeholderOption);

    getAllPlayers().forEach((player) => {
        const option =
            document.createElement("option");

        option.value = player.name;
        option.textContent = player.name;

        select.appendChild(option);
    });

    if (
        [...select.options].some(
            (option) => option.value === currentValue
        )
    ) {
        select.value = currentValue;
    }
}

function loadAllPlayerDropdowns() {
    const selectIds = [
        "singlePlayerA",
        "singlePlayerB",
        "doubleTeamAPlayer1",
        "doubleTeamAPlayer2",
        "doubleTeamBPlayer1",
        "doubleTeamBPlayer2",
        "statsPlayer",
        "resultPlayerOfMatch"
    ];

    selectIds.forEach((id) => {
        fillPlayerSelect(id);
    });

    updateResultWinnerOptions();
}


/* =========================
   ADMIN AUTH
========================= */

async function checkAdmin() {
    try {
        const {
            data: { session }
        } = await supabaseClient.auth.getSession();

        currentUser = session?.user || null;

        if (currentUser) {
            await verifyAdmin();
        } else {
            hideAdminPanel();
        }

    } catch (error) {
        console.error("Admin check error:", error);
        hideAdminPanel();
    }
}

async function verifyAdmin() {
    if (!currentUser) {
        isAdmin = false;
        hideAdminPanel();
        return false;
    }

    try {
        const { data, error } = await supabaseClient
            .from("admin_users")
            .select("*")
            .ilike("email", currentUser.email)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (data) {
            isAdmin = true;
            showAdminPanel();
            return true;
        }

        isAdmin = false;
        hideAdminPanel();

        await supabaseClient.auth.signOut();

        alert("You are not authorized as admin.");

        return false;

    } catch (error) {
        console.error("Admin verification error:", error);

        isAdmin = false;
        hideAdminPanel();

        return false;
    }
}


/* =========================
   LOGIN MODAL
========================= */

const loginModal =
    document.getElementById("loginModal");

const adminLoginBtn =
    document.getElementById("adminLoginBtn");

const footerAdminBtn =
    document.getElementById("footerAdminBtn");

const closeLogin =
    document.getElementById("closeLogin");

function openLoginModal() {
    if (!loginModal) return;

    loginModal.classList.add("show");
}

function closeLoginModal() {
    if (!loginModal) return;

    loginModal.classList.remove("show");
}

if (adminLoginBtn) {
    adminLoginBtn.addEventListener(
        "click",
        openLoginModal
    );
}

if (footerAdminBtn) {
    footerAdminBtn.addEventListener(
        "click",
        openLoginModal
    );
}

if (closeLogin) {
    closeLogin.addEventListener(
        "click",
        closeLoginModal
    );
}

if (loginModal) {
    loginModal.addEventListener(
        "click",
        (event) => {
            if (event.target === loginModal) {
                closeLoginModal();
            }
        }
    );
}

document.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Escape") {
            closeLoginModal();
        }
    }
);


/* =========================
   LOGIN FORM
========================= */

const loginForm =
    document.getElementById("loginForm");

const loginMessage =
    document.getElementById("loginMessage");

if (loginForm) {
    loginForm.addEventListener(
        "submit",
        async (event) => {
            event.preventDefault();

            const emailInput =
                document.getElementById("loginEmail");

            const passwordInput =
                document.getElementById("loginPassword");

            const email =
                emailInput?.value.trim() || "";

            const password =
                passwordInput?.value || "";

            if (!email || !password) {
                if (loginMessage) {
                    loginMessage.textContent =
                        "Please enter email and password.";

                    loginMessage.className =
                        "error";
                }

                return;
            }

            try {
                if (loginMessage) {
                    loginMessage.textContent =
                        "Logging in...";

                    loginMessage.className = "";
                }

                const { data, error } =
                    await supabaseClient.auth
                        .signInWithPassword({
                            email,
                            password
                        });

                if (error) {
                    throw error;
                }

                currentUser = data.user;

                const adminVerified =
                    await verifyAdmin();

                if (!adminVerified) {
                    return;
                }

                if (loginMessage) {
                    loginMessage.textContent =
                        "Login successful!";

                    loginMessage.className =
                        "success";
                }

                setTimeout(() => {
                    closeLoginModal();
                }, 700);

            } catch (error) {
                console.error(
                    "Login error:",
                    error
                );

                if (loginMessage) {
                    loginMessage.textContent =
                        error.message;

                    loginMessage.className =
                        "error";
                }
            }
        }
    );
}


/* =========================
   AUTH STATE
========================= */

supabaseClient.auth.onAuthStateChange(
    async (event, session) => {
        currentUser =
            session?.user || null;

        if (currentUser) {
            await verifyAdmin();
        } else {
            isAdmin = false;
            hideAdminPanel();
        }
    }
);


/* =========================
   ADMIN PANEL
========================= */

function showAdminPanel() {
    const panel =
        document.getElementById("adminPanel");

    if (panel) {
        panel.style.display = "block";
    }
}

function hideAdminPanel() {
    const panel =
        document.getElementById("adminPanel");

    if (panel) {
        panel.style.display = "none";
    }
}


/* =========================
   LOGOUT
========================= */

const logoutBtn =
    document.getElementById("logoutBtn");

if (logoutBtn) {
    logoutBtn.addEventListener(
        "click",
        async () => {

            await supabaseClient.auth.signOut();

            currentUser = null;
            isAdmin = false;

            hideAdminPanel();

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        }
    );
}


/* =========================
   ADD PLAYER
========================= */

const playerForm =
    document.getElementById("playerForm");

if (playerForm) {
    playerForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!isAdmin) {
                alert("Admin login required.");
                return;
            }

            const playerNameInput =
                document.getElementById("playerName");

            const playerName =
                playerNameInput?.value.trim() || "";

            if (!playerName) {
                alert("Enter player name.");
                return;
            }

            const duplicate =
                savedPlayers.some(
                    (player) =>
                        String(player.name).toLowerCase() ===
                        playerName.toLowerCase()
                );

            if (duplicate) {
                alert("This player already exists.");
                return;
            }

            try {
                const { error } =
                    await supabaseClient
                        .from("players")
                        .insert({
                            name: playerName
                        });

                if (error) {
                    throw error;
                }

                playerForm.reset();

                await loadDatabase();

                alert(
                    "Player added successfully."
                );

            } catch (error) {
                console.error(
                    "Add player error:",
                    error
                );

                alert(
                    `Error: ${error.message}`
                );
            }
        }
    );
}


/* =========================
   DELETE PLAYER
========================= */

async function deletePlayer(playerId, playerName) {

    if (!isAdmin) {
        alert("Admin login required.");
        return;
    }

    const player =
        savedPlayers.find(
            (item) =>
                String(item.id) ===
                String(playerId)
        );

    if (!player) {
        alert("Player not found.");
        return;
    }

    const playerUsedInMatch =
        savedMatches.some((match) =>
            getPlayerNames(match).some(
                (name) =>
                    String(name).toLowerCase() ===
                    String(playerName).toLowerCase()
            )
        );

    if (playerUsedInMatch) {
        alert(
            `Cannot delete "${playerName}".\n\n` +
            "This player is already included in one or more matches.\n\n" +
            "Please remove the related match first."
        );

        return;
    }

    const confirmed = confirm(
        `Delete player "${playerName}"?\n\n` +
        "The player's statistics will also be removed.\n\n" +
        "This action cannot be undone.`
    );

    if (!confirmed) {
        return;
    }

    try {

        /* DELETE PLAYER STATS */
        const { error: statsError } =
            await supabaseClient
                .from("stats")
                .delete()
                .eq("player", playerName);

        if (statsError) {
            throw statsError;
        }


        /* DELETE PLAYER */
        const { error: playerError } =
            await supabaseClient
                .from("players")
                .delete()
                .eq("id", playerId);

        if (playerError) {
            throw playerError;
        }


        await loadDatabase();

        alert(
            `"${playerName}" has been deleted successfully.`
        );

    } catch (error) {

        console.error(
            "Delete player error:",
            error
        );

        alert(
            "Player delete failed.\n\n" +
            error.message
        );

        await loadDatabase();
    }
}


/* =========================
   MATCH TYPE
========================= */

const matchType =
    document.getElementById("matchType");

function updateMatchTypeFields() {

    const singleFields =
        document.getElementById(
            "singleMatchFields"
        );

    const doubleFields =
        document.getElementById(
            "doubleMatchFields"
        );

    if (!matchType) return;

    const isSingle =
        matchType.value === "single";

    if (singleFields) {
        singleFields.style.display =
            isSingle
                ? "block"
                : "none";
    }

    if (doubleFields) {
        doubleFields.style.display =
            isSingle
                ? "none"
                : "block";
    }

    updateResultWinnerOptions();
}

if (matchType) {

    matchType.addEventListener(
        "change",
        updateMatchTypeFields
    );

    updateMatchTypeFields();
}


/* =========================
   ADD MATCH
========================= */

const matchForm =
    document.getElementById("matchForm");

if (matchForm) {

    matchForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!isAdmin) {
                alert("Admin login required.");
                return;
            }

            const type =
                document.getElementById(
                    "matchType"
                )?.value || "single";

            const date =
                document.getElementById(
                    "matchDate"
                )?.value || "";

            const time =
                document.getElementById(
                    "matchTime"
                )?.value || "";

            const venue =
                document.getElementById(
                    "matchVenue"
                )?.value.trim() || "";

            if (!date || !time || !venue) {
                alert(
                    "Please fill date, time and venue."
                );

                return;
            }

            let matchData = {
                type,
                date,
                time,
                venue,
                status: "Upcoming"
            };

            if (type === "single") {

                const playerA =
                    document.getElementById(
                        "singlePlayerA"
                    )?.value || "";

                const playerB =
                    document.getElementById(
                        "singlePlayerB"
                    )?.value || "";

                if (!playerA || !playerB) {
                    alert(
                        "Select both players."
                    );

                    return;
                }

                if (playerA === playerB) {
                    alert(
                        "A player cannot play against himself."
                    );

                    return;
                }

                matchData.player_a =
                    playerA;

                matchData.player_b =
                    playerB;

                matchData.team_a =
                    [playerA];

                matchData.team_b =
                    [playerB];

            } else {

                const teamAPlayer1 =
                    document.getElementById(
                        "doubleTeamAPlayer1"
                    )?.value || "";

                const teamAPlayer2 =
                    document.getElementById(
                        "doubleTeamAPlayer2"
                    )?.value || "";

                const teamBPlayer1 =
                    document.getElementById(
                        "doubleTeamBPlayer1"
                    )?.value || "";

                const teamBPlayer2 =
                    document.getElementById(
                        "doubleTeamBPlayer2"
                    )?.value || "";

                const players = [
                    teamAPlayer1,
                    teamAPlayer2,
                    teamBPlayer1,
                    teamBPlayer2
                ];

                if (
                    players.some(
                        (player) => !player
                    )
                ) {
                    alert(
                        "Select all four players."
                    );

                    return;
                }

                const uniquePlayers =
                    new Set(players);

                if (uniquePlayers.size !== 4) {
                    alert(
                        "All four players must be different."
                    );

                    return;
                }

                matchData.team_a = [
                    teamAPlayer1,
                    teamAPlayer2
                ];

                matchData.team_b = [
                    teamBPlayer1,
                    teamBPlayer2
                ];
            }

            try {

                const { error } =
                    await supabaseClient
                        .from("matches")
                        .insert(matchData);

                if (error) {
                    throw error;
                }

                matchForm.reset();

                updateMatchTypeFields();

                await loadDatabase();

                alert(
                    "Match added successfully."
                );

            } catch (error) {

                console.error(
                    "Add match error:",
                    error
                );

                alert(
                    `Error: ${error.message}`
                );
            }
        }
    );
}


/* =========================
   TODAY / TOMORROW
========================= */

function renderMatches() {

    const todayContainer =
        document.getElementById(
            "todayMatchesContainer"
        );

    const tomorrowContainer =
        document.getElementById(
            "tomorrowMatchesContainer"
        );

    if (
        !todayContainer ||
        !tomorrowContainer
    ) {
        return;
    }

    const today =
        new Date();

    const tomorrow =
        new Date();

    tomorrow.setDate(
        tomorrow.getDate() + 1
    );

    const todayString =
        formatLocalDate(today);

    const tomorrowString =
        formatLocalDate(tomorrow);

    const todayMatches =
        savedMatches.filter(
            (match) =>
                match.date === todayString
        );

    const tomorrowMatches =
        savedMatches.filter(
            (match) =>
                match.date === tomorrowString
        );

    renderMatchList(
        todayContainer,
        todayMatches,
        "No matches scheduled for today."
    );

    renderMatchList(
        tomorrowContainer,
        tomorrowMatches,
        "No matches scheduled for tomorrow."
    );
}

function renderMatchList(
    container,
    matches,
    emptyMessage
) {

    if (!matches.length) {

        container.innerHTML = `
            <div class="empty-card">
                <p>
                    ${escapeHTML(emptyMessage)}
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        matches
            .map(createMatchCard)
            .join("");
}


/* =========================
   MATCH CARD
========================= */

function createMatchCard(match) {

    const isSingle =
        match.type === "single";

    const teamA =
        getTeamDisplay(match, "A");

    const teamB =
        getTeamDisplay(match, "B");

    return `
        <div class="match-card">

            <span class="badge ${
                isSingle
                    ? "single"
                    : "double"
            }">

                ${
                    isSingle
                        ? "SINGLE WICKET • 1V1"
                        : "DOUBLE WICKET • 2V2"
                }

            </span>

            <div class="match-teams">

                <div class="team">
                    ${escapeHTML(teamA)}
                </div>

                <div class="vs">
                    VS
                </div>

                <div class="team">
                    ${escapeHTML(teamB)}
                </div>

            </div>

            <div class="match-info">

                <span>
                    📅 ${escapeHTML(match.date)}
                </span>

                <span>
                    ⏰ ${escapeHTML(match.time)}
                </span>

                <span>
                    📍 ${escapeHTML(match.venue)}
                </span>

            </div>

            <div class="match-status">
                ${escapeHTML(
                    match.status || "Upcoming"
                )}
            </div>

        </div>
    `;
}


/* =========================
   SINGLE / DOUBLE WICKET
========================= */

function renderSingleDoubleWickets() {

    const singleContainer =
        document.getElementById(
            "singleWicketContainer"
        );

    const doubleContainer =
        document.getElementById(
            "doubleWicketContainer"
        );

    if (singleContainer) {

        const singleMatches =
            savedMatches.filter(
                (match) =>
                    match.type === "single"
            );

        renderMatchList(
            singleContainer,
            singleMatches,
            "No single wicket matches."
        );
    }

    if (doubleContainer) {

        const doubleMatches =
            savedMatches.filter(
                (match) =>
                    match.type === "double"
            );

        renderMatchList(
            doubleContainer,
            doubleMatches,
            "No double wicket matches."
        );
    }
}


/* =========================
   RESULT MATCH OPTIONS
========================= */

function loadMatchOptions() {

    const resultMatch =
        document.getElementById(
            "resultMatch"
        );

    if (!resultMatch) return;

    const currentValue =
        resultMatch.value;

    resultMatch.innerHTML = `
        <option value="">
            Select Match
        </option>
    `;

    const incompleteMatches =
        savedMatches.filter(
            (match) =>
                String(match.status)
                    .toLowerCase() !==
                "completed"
        );

    incompleteMatches.forEach(
        (match) => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                match.id;

            option.textContent =
                `${match.date} ${match.time} — ` +
                `${getTeamDisplay(match, "A")} vs ` +
                `${getTeamDisplay(match, "B")}`;

            resultMatch.appendChild(
                option
            );
        }
    );

    if (
        [...resultMatch.options].some(
            (option) =>
                option.value === currentValue
        )
    ) {
        resultMatch.value =
            currentValue;
    }

    updateResultWinnerOptions();
}

const resultMatch =
    document.getElementById(
        "resultMatch"
    );

if (resultMatch) {

    resultMatch.addEventListener(
        "change",
        updateResultWinnerOptions
    );
}


/* =========================
   WINNER OPTIONS
========================= */

function updateResultWinnerOptions() {

    const resultMatchElement =
        document.getElementById(
            "resultMatch"
        );

    const winnerSelect =
        document.getElementById(
            "winner"
        );

    const playerOfMatchSelect =
        document.getElementById(
            "resultPlayerOfMatch"
        );

    if (!resultMatchElement) return;

    if (winnerSelect) {

        winnerSelect.innerHTML = `
            <option value="">
                Select Winner
            </option>
        `;
    }

    if (playerOfMatchSelect) {

        playerOfMatchSelect.innerHTML = `
            <option value="">
                Select Player of Match
            </option>
        `;
    }

    const matchId =
        resultMatchElement.value;

    if (!matchId) return;

    const match =
        savedMatches.find(
            (item) =>
                String(item.id) ===
                String(matchId)
        );

    if (!match) return;

    const teamA =
        getTeamDisplay(match, "A");

    const teamB =
        getTeamDisplay(match, "B");

    if (winnerSelect) {

        const optionA =
            document.createElement(
                "option"
            );

        optionA.value = "A";

        optionA.textContent =
            `Team A — ${teamA}`;

        winnerSelect.appendChild(
            optionA
        );

        const optionB =
            document.createElement(
                "option"
            );

        optionB.value = "B";

        optionB.textContent =
            `Team B — ${teamB}`;

        winnerSelect.appendChild(
            optionB
        );
    }

    if (playerOfMatchSelect) {

        getPlayerNames(match)
            .forEach((player) => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    player;

                option.textContent =
                    player;

                playerOfMatchSelect
                    .appendChild(option);
            });
    }
}


/* =========================
   RESULT HELPERS
========================= */

function hasResultForMatch(matchId) {

    return savedResults.some(
        (result) =>
            String(result.match_id) ===
            String(matchId)
    );
}

async function ensurePlayerStats(
    playerName
) {

    if (!playerName) return;

    const existing =
        savedStats.find(
            (stat) =>
                String(stat.player)
                    .toLowerCase() ===
                String(playerName)
                    .toLowerCase()
        );

    if (existing) return;

    const { error } =
        await supabaseClient
            .from("stats")
            .insert({
                player: playerName,
                runs: 0,
                wickets: 0,
                wins: 0
            });

    if (error) {
        throw error;
    }
}


/* =========================
   ADD RESULT
========================= */

const resultForm =
    document.getElementById(
        "resultForm"
    );

if (resultForm) {

    resultForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!isAdmin) {
                alert(
                    "Admin login required."
                );

                return;
            }

            const matchId =
                document.getElementById(
                    "resultMatch"
                )?.value || "";

            const winner =
                document.getElementById(
                    "winner"
                )?.value || "";

            const score =
                document.getElementById(
                    "score"
                )?.value.trim() || "";

            const playerOfMatch =
                document.getElementById(
                    "resultPlayerOfMatch"
                )?.value || "";

            if (
                !matchId ||
                !winner ||
                !score ||
                !playerOfMatch
            ) {
                alert(
                    "Please fill all result fields."
                );

                return;
            }

            if (
                hasResultForMatch(matchId)
            ) {
                alert(
                    "This match already has a result."
                );

                return;
            }

            const match =
                savedMatches.find(
                    (item) =>
                        String(item.id) ===
                        String(matchId)
                );

            if (!match) {
                alert(
                    "Match not found."
                );

                return;
            }

            const winnerPlayers =
                winner === "A"
                    ? (
                        match.type === "single"
                            ? [match.player_a]
                            : match.team_a
                    )
                    : (
                        match.type === "single"
                            ? [match.player_b]
                            : match.team_b
                    );

            const winnerTeamName =
                winner === "A"
                    ? getTeamDisplay(
                        match,
                        "A"
                    )
                    : getTeamDisplay(
                        match,
                        "B"
                    );

            const loserTeamName =
                winner === "A"
                    ? getTeamDisplay(
                        match,
                        "B"
                    )
                    : getTeamDisplay(
                        match,
                        "A"
                    );

            try {

                for (
                    const player
                    of winnerPlayers
                ) {

                    if (!player) continue;

                    await ensurePlayerStats(
                        player
                    );

                    const existingStat =
                        savedStats.find(
                            (stat) =>
                                String(
                                    stat.player
                                ).toLowerCase() ===
                                String(
                                    player
                                ).toLowerCase()
                        );

                    const currentWins =
                        Number(
                            existingStat?.wins ||
                            0
                        );

                    const { error } =
                        await supabaseClient
                            .from("stats")
                            .update({
                                wins:
                                    currentWins + 1
                            })
                            .eq(
                                "player",
                                player
                            );

                    if (error) {
                        throw error;
                    }
                }

                const {
                    error: resultError
                } =
                    await supabaseClient
                        .from("results")
                        .insert({
                            match_id:
                                match.id,

                            winner_team:
                                winner,

                            winner:
                                winnerTeamName,

                            loser:
                                loserTeamName,

                            score,

                            player_of_match:
                                playerOfMatch
                        });

                if (resultError) {
                    throw resultError;
                }

                const {
                    error: matchError
                } =
                    await supabaseClient
                        .from("matches")
                        .update({
                            status:
                                "Completed"
                        })
                        .eq(
                            "id",
                            match.id
                        );

                if (matchError) {
                    throw matchError;
                }

                resultForm.reset();

                await loadDatabase();

                alert(
                    "Result added successfully."
                );

            } catch (error) {

                console.error(
                    "Add result error:",
                    error
                );

                alert(
                    `Error: ${error.message}`
                );
            }
        }
    );
}


/* =========================
   RESULTS DISPLAY
========================= */

function renderResults() {

    const container =
        document.getElementById(
            "resultsContainer"
        );

    if (!container) return;

    if (!savedResults.length) {

        container.innerHTML = `
            <div class="empty-card">
                <p>
                    No results available yet.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        savedResults
            .map((result) => {

                const match =
                    savedMatches.find(
                        (item) =>
                            String(
                                item.id
                            ) ===
                            String(
                                result.match_id
                            )
                    );

                const type =
                    match?.type === "double"
                        ? "DOUBLE WICKET • 2V2"
                        : "SINGLE WICKET • 1V1";

                return `
                    <div class="result-card">

                        <span class="badge">
                            ${escapeHTML(type)}
                        </span>

                        <h3>
                            ${escapeHTML(
                                result.winner ||
                                "Winner"
                            )}
                        </h3>

                        <p>
                            <strong>
                                Score:
                            </strong>

                            ${escapeHTML(
                                result.score || "-"
                            )}
                        </p>

                        <p>
                            <strong>
                                Defeated:
                            </strong>

                            ${escapeHTML(
                                result.loser || "-"
                            )}
                        </p>

                        <p>
                            <strong>
                                Player of Match:
                            </strong>

                            ${escapeHTML(
                                result.player_of_match ||
                                "-"
                            )}
                        </p>

                    </div>
                `;
            })
            .join("");
}


/* =========================
   STATS FORM
========================= */

const statsForm =
    document.getElementById(
        "statsForm"
    );

if (statsForm) {

    statsForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            if (!isAdmin) {
                alert(
                    "Admin login required."
                );

                return;
            }

            const player =
                document.getElementById(
                    "statsPlayer"
                )?.value || "";

            const runs =
                Number(
                    document.getElementById(
                        "statsRuns"
                    )?.value || 0
                );

            const wickets =
                Number(
                    document.getElementById(
                        "statsWickets"
                    )?.value || 0
                );

            const wins =
                Number(
                    document.getElementById(
                        "statsWins"
                    )?.value || 0
                );

            if (!player) {
                alert(
                    "Select a player."
                );

                return;
            }

            try {

                const { error } =
                    await supabaseClient
                        .from("stats")
                        .upsert(
                            {
                                player,
                                runs,
                                wickets,
                                wins
                            },
                            {
                                onConflict:
                                    "player"
                            }
                        );

                if (error) {
                    throw error;
                }

                statsForm.reset();

                await loadDatabase();

                alert(
                    "Statistics updated successfully."
                );

            } catch (error) {

                console.error(
                    "Stats error:",
                    error
                );

                alert(
                    `Error: ${error.message}`
                );
            }
        }
    );
}


/* =========================
   TOP STATISTICS
========================= */

function renderTopStatistics() {

    const topScorer =
        document.getElementById(
            "topScorer"
        );

    const topScorerRuns =
        document.getElementById(
            "topScorerRuns"
        );

    const bestBowler =
        document.getElementById(
            "bestBowler"
        );

    const bestBowlerWickets =
        document.getElementById(
            "bestBowlerWickets"
        );

    const mostWins =
        document.getElementById(
            "mostWins"
        );

    const mostWinsCount =
        document.getElementById(
            "mostWinsCount"
        );

    if (!savedStats.length) {

        if (topScorer)
            topScorer.textContent = "-";

        if (topScorerRuns)
            topScorerRuns.textContent =
                "0";

        if (bestBowler)
            bestBowler.textContent = "-";

        if (bestBowlerWickets)
            bestBowlerWickets.textContent =
                "0";

        if (mostWins)
            mostWins.textContent = "-";

        if (mostWinsCount)
            mostWinsCount.textContent =
                "0";

        return;
    }

    const scorer =
        [...savedStats].sort(
            (a, b) =>
                Number(b.runs || 0) -
                Number(a.runs || 0)
        )[0];

    const bowler =
        [...savedStats].sort(
            (a, b) =>
                Number(b.wickets || 0) -
                Number(a.wickets || 0)
        )[0];

    const winner =
        [...savedStats].sort(
            (a, b) =>
                Number(b.wins || 0) -
                Number(a.wins || 0)
        )[0];

    if (topScorer) {
        topScorer.textContent =
            scorer?.player || "-";
    }

    if (topScorerRuns) {
        topScorerRuns.textContent =
            Number(
                scorer?.runs || 0
            );
    }

    if (bestBowler) {
        bestBowler.textContent =
            bowler?.player || "-";
    }

    if (bestBowlerWickets) {
        bestBowlerWickets.textContent =
            Number(
                bowler?.wickets || 0
            );
    }

    if (mostWins) {
        mostWins.textContent =
            winner?.player || "-";
    }

    if (mostWinsCount) {
        mostWinsCount.textContent =
            Number(
                winner?.wins || 0
            );
    }
}


/* =========================
   PLAYER OF MATCH COUNT
========================= */

function getPlayerOfMatchCount(
    playerName
) {

    return savedResults.filter(
        (result) =>
            String(
                result.player_of_match
            ).toLowerCase() ===
            String(
                playerName
            ).toLowerCase()
    ).length;
}


/* =========================
   PLAYERS DISPLAY
========================= */

function renderPlayers() {

    const container =
        document.getElementById(
            "playersContainer"
        );

    if (!container) return;

    if (!savedPlayers.length) {

        container.innerHTML = `
            <div class="empty-card">
                <p>
                    No players added yet.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML =
        savedPlayers
            .map((player) => {

                const stat =
                    savedStats.find(
                        (item) =>
                            String(
                                item.player
                            ).toLowerCase() ===
                            String(
                                player.name
                            ).toLowerCase()
                    );

                const matchesPlayed =
                    savedMatches.filter(
                        (match) =>
                            String(
                                match.status
                            ).toLowerCase() ===
                                "completed" &&
                            getPlayerNames(
                                match
                            ).some(
                                (name) =>
                                    String(
                                        name
                                    ).toLowerCase() ===
                                    String(
                                        player.name
                                    ).toLowerCase()
                            )
                    ).length;

                const pom =
                    getPlayerOfMatchCount(
                        player.name
                    );

                return `
                    <div class="player-card">

                        <h3>
                            ${escapeHTML(
                                player.name
                            )}
                        </h3>

                        <div class="player-stats">

                            <div>
                                <strong>
                                    ${Number(
                                        stat?.runs ||
                                        0
                                    )}
                                </strong>

                                <span>
                                    Runs
                                </span>
                            </div>

                            <div>
                                <strong>
                                    ${Number(
                                        stat?.wickets ||
                                        0
                                    )}
                                </strong>

                                <span>
                                    Wickets
                                </span>
                            </div>

                            <div>
                                <strong>
                                    ${Number(
                                        stat?.wins ||
                                        0
                                    )}
                                </strong>

                                <span>
                                    Wins
                                </span>
                            </div>

                            <div>
                                <strong>
                                    ${matchesPlayed}
                                </strong>

                                <span>
                                    Matches
                                </span>
                            </div>

                            <div>
                                <strong>
                                    ${pom}
                                </strong>

                                <span>
                                    POM
                                </span>
                            </div>

                        </div>

                        ${
                            isAdmin
                                ? `
                                    <button
                                        type="button"
                                        class="admin-btn danger-btn"
                                        style="margin-top:15px;"
                                        onclick="deletePlayer('${escapeHTML(
                                            player.id
                                        )}', '${escapeHTML(
                                            player.name
                                        ).replace(
                                            /'/g,
                                            "\\'"
                                        )}')"
                                    >
                                        🗑️ Delete Player
                                    </button>
                                `
                                : ""
                        }

                    </div>
                `;
            })
            .join("");
}


/* =========================
   FULL SCHEDULE
========================= */

function renderFullSchedule() {

    const container =
        document.getElementById(
            "fullScheduleContainer"
        );

    if (!container) return;

    if (!savedMatches.length) {

        container.innerHTML = `
            <tr>
                <td colspan="6">
                    No matches scheduled yet.
                </td>
            </tr>
        `;

        return;
    }

    const rows =
        savedMatches
            .map((match) => {

                const isSingle =
                    match.type === "single";

                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                match.date
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                match.time
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                getTeamDisplay(
                                    match,
                                    "A"
                                )
                            )}

                            <strong>
                                vs
                            </strong>

                            ${escapeHTML(
                                getTeamDisplay(
                                    match,
                                    "B"
                                )
                            )}
                        </td>

                        <td>
                            ${
                                isSingle
                                    ? "Single"
                                    : "Double"
                            }
                        </td>

                        <td>
                            ${escapeHTML(
                                match.venue
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                match.status ||
                                "Upcoming"
                            )}
                        </td>

                    </tr>
                `;
            })
            .join("");

    container.innerHTML = rows;
}


/* =========================
   RESET TOURNAMENT DATA
========================= */

const resetTournamentBtn =
    document.getElementById(
        "resetTournamentBtn"
    );

async function resetTournamentData() {

    if (!isAdmin) {
        alert(
            "Admin login required."
        );

        return;
    }

    const firstConfirm =
        confirm(
            "WARNING!\n\n" +
            "This will delete all tournament data:\n\n" +
            "• Players\n" +
            "• Matches\n" +
            "• Results\n" +
            "• Statistics\n\n" +
            "Your admin account and website design will NOT be deleted.\n\n" +
            "Continue?"
        );

    if (!firstConfirm) {
        return;
    }

    const finalConfirm =
        confirm(
            "FINAL WARNING!\n\n" +
            "All tournament data will be permanently deleted.\n\n" +
            "Are you absolutely sure?"
        );

    if (!finalConfirm) {
        return;
    }

    if (resetTournamentBtn) {

        resetTournamentBtn.disabled =
            true;

        resetTournamentBtn.textContent =
            "⏳ Resetting...";
    }

    try {

        const {
            error: resultsError
        } =
            await supabaseClient
                .from("results")
                .delete()
                .not(
                    "id",
                    "is",
                    null
                );

        if (resultsError) {
            throw resultsError;
        }

        const {
            error: matchesError
        } =
            await supabaseClient
                .from("matches")
                .delete()
                .not(
                    "id",
                    "is",
                    null
                );

        if (matchesError) {
            throw matchesError;
        }

        const {
            error: statsError
        } =
            await supabaseClient
                .from("stats")
                .delete()
                .not(
                    "player",
                    "is",
                    null
                );

        if (statsError) {
            throw statsError;
        }

        const {
            error: playersError
        } =
            await supabaseClient
                .from("players")
                .delete()
                .not(
                    "id",
                    "is",
                    null
                );

        if (playersError) {
            throw playersError;
        }

        savedPlayers = [];
        savedMatches = [];
        savedResults = [];
        savedStats = [];

        renderEverything();

        alert(
            "Tournament data has been reset successfully."
        );

    } catch (error) {

        console.error(
            "Reset error:",
            error
        );

        alert(
            "Reset failed.\n\n" +
            error.message
        );

        await loadDatabase();

    } finally {

        if (resetTournamentBtn) {

            resetTournamentBtn.disabled =
                false;

            resetTournamentBtn.textContent =
                "🗑️ Reset Tournament Data";
        }
    }
}

if (resetTournamentBtn) {

    resetTournamentBtn.addEventListener(
        "click",
        resetTournamentData
    );
}


/* =========================
   START WEBSITE
========================= */

async function startWebsite() {

    console.log(
        "Cross Cricket website starting..."
    );

    await checkAdmin();

    await loadDatabase();

    console.log(
        "Cross Cricket website ready."
    );
}

startWebsite();


/* =========================
   AUTO REFRESH
========================= */

setInterval(
    async () => {
        await loadDatabase();
    },
    60000
);