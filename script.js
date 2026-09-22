/* =========================================================
   CROSS CRICKET - MAIN SCRIPT
   Supabase + Admin Panel + Matches + Results + Stats
   ========================================================= */


/* =========================================================
   1. SUPABASE
   ========================================================= */

const SUPABASE_URL =
    "https://zgenbnkzoxxacrrsjibj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_zHZKaQ7Lpkrzbt7_Ebh-vQ_zfIUX3Aj";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);


/* =========================================================
   2. GLOBAL DATA
   ========================================================= */

let players = [];
let matches = [];
let results = [];
let stats = [];

let currentUser = null;


/* =========================================================
   3. BASIC HELPERS
   ========================================================= */

function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatLocalDate(dateString) {
    if (!dateString) {
        return "";
    }

    const date = new Date(`${dateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function normalizeMatchType(value) {
    const type = String(value || "").toLowerCase().trim();

    if (type.includes("single")) {
        return "single";
    }

    if (type.includes("double")) {
        return "double";
    }

    return "";
}


function isSingleMatch(match) {
    return normalizeMatchType(match?.type) === "single";
}


function isDoubleMatch(match) {
    return normalizeMatchType(match?.type) === "double";
}


/*
   Converts database player/team values into display text.

   Single:
   "Ansar"

   Double:
   ["Ansar", "Danish"]
   ->
   "Ansar & Danish"
*/
function getPlayerNames(player) {

    if (!player) {
        return "";
    }

    if (Array.isArray(player)) {

        return player
            .map(function (name) {
                return String(name).trim();
            })
            .filter(Boolean)
            .join(" & ");
    }

    return String(player)
        .trim()
        .replace(/,/g, " & ");
}


/*
   Gets Team A / Team B using the REAL database columns.

   Single Wicket:
   player_a / player_b

   Double Wicket:
   team_a_players / team_b_players
*/
function getTeamDisplay(match, side) {

    if (!match) {
        return "";
    }

    if (side === "A") {

        if (isSingleMatch(match)) {
            return getPlayerNames(match.player_a);
        }

        return getPlayerNames(match.team_a_players);
    }

    if (side === "B") {

        if (isSingleMatch(match)) {
            return getPlayerNames(match.player_b);
        }

        return getPlayerNames(match.team_b_players);
    }

    return "";
}


function getTodayString() {

    const now = new Date();

    const year =
        now.getFullYear();

    const month =
        String(now.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(now.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getTomorrowString() {

    const tomorrow =
        new Date();

    tomorrow.setDate(
        tomorrow.getDate() + 1
    );

    const year =
        tomorrow.getFullYear();

    const month =
        String(tomorrow.getMonth() + 1)
            .padStart(2, "0");

    const day =
        String(tomorrow.getDate())
            .padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function sortMatchesByDateTime(list) {

    return [...list].sort((a, b) => {

        const dateA =
            new Date(
                `${a.date || "9999-12-31"}T${a.time || "23:59"}`
            );

        const dateB =
            new Date(
                `${b.date || "9999-12-31"}T${b.time || "23:59"}`
            );

        return dateA - dateB;
    });
}


/*
   Returns all players participating in a match.
   Used for Player of the Match.
*/
function getMatchPlayers(match) {

    if (!match) {
        return [];
    }

    let matchPlayers = [];

    if (isSingleMatch(match)) {

        matchPlayers.push(
            match.player_a
        );

        matchPlayers.push(
            match.player_b
        );

    } else {

        if (Array.isArray(match.team_a_players)) {

            matchPlayers.push(
                ...match.team_a_players
            );

        } else if (match.player_a) {

            matchPlayers.push(
                ...String(match.player_a)
                    .split("&")
                    .map(function (name) {
                        return name.trim();
                    })
            );
        }


        if (Array.isArray(match.team_b_players)) {

            matchPlayers.push(
                ...match.team_b_players
            );

        } else if (match.player_b) {

            matchPlayers.push(
                ...String(match.player_b)
                    .split("&")
                    .map(function (name) {
                        return name.trim();
                    })
            );
        }
    }


    return matchPlayers
        .map(function (name) {
            return String(name || "").trim();
        })
        .filter(Boolean);
}


/* =========================================================
   4. DOM ELEMENTS
   ========================================================= */

const loginModal =
    document.getElementById("loginModal");

const adminLoginBtn =
    document.getElementById("adminLoginBtn");

const footerAdminBtn =
    document.getElementById("footerAdminBtn");

const closeLogin =
    document.getElementById("closeLogin");

const loginForm =
    document.getElementById("loginForm");

const loginEmail =
    document.getElementById("loginEmail");

const loginPassword =
    document.getElementById("loginPassword");

const loginMessage =
    document.getElementById("loginMessage");

const adminPanel =
    document.getElementById("adminPanel");

const logoutBtn =
    document.getElementById("logoutBtn");

const playerForm =
    document.getElementById("playerForm");

const matchForm =
    document.getElementById("matchForm");

const resultForm =
    document.getElementById("resultForm");

const statsForm =
    document.getElementById("statsForm");

const matchType =
    document.getElementById("matchType");

const singleMatchFields =
    document.getElementById("singleMatchFields");

const doubleMatchFields =
    document.getElementById("doubleMatchFields");

const resetTournamentBtn =
    document.getElementById("resetTournamentBtn");

const playersContainer =
    document.getElementById("playersContainer");


/* =========================================================
   5. LOGIN MODAL
   ========================================================= */

function openLoginModal() {

    if (!loginModal) {
        return;
    }

    loginModal.style.display = "flex";

    if (loginMessage) {
        loginMessage.textContent = "";
    }

    if (loginEmail) {
        loginEmail.focus();
    }
}


function closeLoginModal() {

    if (!loginModal) {
        return;
    }

    loginModal.style.display = "none";
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
        function (event) {

            if (event.target === loginModal) {
                closeLoginModal();
            }

        }
    );
}


/* =========================================================
   6. ADMIN PANEL
   ========================================================= */

function showAdminPanel() {

    if (adminPanel) {
        adminPanel.style.display = "block";
    }
}


function hideAdminPanel() {

    if (adminPanel) {
        adminPanel.style.display = "none";
    }
}


async function verifyAdmin(email) {

    if (!email) {
        return false;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("admin_users")
        .select("email")
        .eq("email", email)
        .maybeSingle();

    if (error) {

        console.error(
            "Admin verification error:",
            error
        );

        return false;
    }

    return !!data;
}


async function checkAdmin(user) {

    if (!user) {

        currentUser = null;

        hideAdminPanel();

        return;
    }

    const isAdmin =
        await verifyAdmin(user.email);

    if (isAdmin) {

        currentUser = user;

        showAdminPanel();

    } else {

        currentUser = null;

        hideAdminPanel();
    }
}


/* =========================================================
   7. LOGIN
   ========================================================= */

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            const email =
                loginEmail?.value.trim();

            const password =
                loginPassword?.value;

            if (!email || !password) {
                return;
            }

            if (loginMessage) {
                loginMessage.textContent =
                    "Logging in...";
            }

            const {
                data,
                error
            } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {

                console.error(error);

                if (loginMessage) {
                    loginMessage.textContent =
                        error.message;
                }

                return;
            }

            const isAdmin =
                await verifyAdmin(data.user?.email);

            if (!isAdmin) {

                await supabaseClient.auth.signOut();

                if (loginMessage) {
                    loginMessage.textContent =
                        "This account is not an authorized admin.";
                }

                return;
            }

            currentUser = data.user;

            closeLoginModal();

            showAdminPanel();

            await loadData();

            alert(
                "Admin login successful."
            );

        }
    );
}


/* =========================================================
   8. LOGOUT
   ========================================================= */

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function () {

            const {
                error
            } = await supabaseClient.auth.signOut();

            if (error) {

                console.error(
                    "Logout error:",
                    error
                );

                return;
            }

            currentUser = null;

            hideAdminPanel();

            alert(
                "Logged out successfully."
            );

        }
    );
}


/* =========================================================
   9. AUTH STATE
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
    async function (_event, session) {

        if (session?.user) {

            const isAdmin =
                await verifyAdmin(
                    session.user.email
                );

            if (isAdmin) {

                currentUser =
                    session.user;

                showAdminPanel();

            } else {

                currentUser = null;

                hideAdminPanel();
            }

        } else {

            currentUser = null;

            hideAdminPanel();
        }

    }
);


/* =========================================================
   10. LOAD DATABASE
   ========================================================= */

async function loadData() {

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
                .order("name", {
                    ascending: true
                }),

            supabaseClient
                .from("matches")
                .select("*")
                .order("date", {
                    ascending: true
                })
                .order("time", {
                    ascending: true
                }),

            supabaseClient
                .from("results")
                .select("*")
                .order("created_at", {
                    ascending: false
                }),

            supabaseClient
                .from("stats")
                .select("*")
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


        players =
            playersResponse.data || [];

        matches =
            matchesResponse.data || [];

        results =
            resultsResponse.data || [];

        stats =
            statsResponse.data || [];


        renderEverything();

    } catch (error) {

        console.error(
            "Database loading error:",
            error
        );

        alert(
            "Database load error: " +
            (error.message || "Unknown error")
        );
    }
}


/* =========================================================
   11. RENDER EVERYTHING
   ========================================================= */

function renderEverything() {

    fillPlayerDropdowns();

    renderTodayMatches();

    renderTomorrowMatches();

    renderSingleWicket();

    renderDoubleWicket();

    renderFullSchedule();

    renderResultOptions();

    renderResults();

    renderStats();

    renderPlayers();
}


/* =========================================================
   12. PLAYER DROPDOWNS
   ========================================================= */

function fillPlayerDropdowns() {

    const dropdownIds = [

        "singlePlayerA",
        "singlePlayerB",

        "doublePlayerA1",
        "doublePlayerA2",

        "doublePlayerB1",
        "doublePlayerB2",

        "statsPlayer",

        "playerOfMatch"

    ];


    dropdownIds.forEach(function (id) {

        const select =
            document.getElementById(id);

        if (!select) {
            return;
        }

        const firstOption =
            select.options[0]
                ? select.options[0].textContent
                : "Select Player";


        select.innerHTML = "";

        const defaultOption =
            document.createElement("option");

        defaultOption.value = "";

        defaultOption.textContent =
            firstOption;

        select.appendChild(
            defaultOption
        );


        players.forEach(function (player) {

            const option =
                document.createElement("option");

            option.value =
                player.name;

            option.textContent =
                player.name;

            select.appendChild(
                option
            );

        });

    });
}


/* =========================================================
   13. MATCH TYPE UI
   ========================================================= */

function updateMatchTypeFields() {

    const type =
        normalizeMatchType(
            matchType?.value
        );


    if (singleMatchFields) {

        singleMatchFields.style.display =
            type === "single"
                ? "block"
                : "none";
    }


    if (doubleMatchFields) {

        doubleMatchFields.style.display =
            type === "double"
                ? "block"
                : "none";
    }
}


if (matchType) {

    matchType.addEventListener(
        "change",
        updateMatchTypeFields
    );

    updateMatchTypeFields();
}


/* =========================================================
   14. ADD PLAYER
   ========================================================= */

if (playerForm) {

    playerForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (!currentUser) {

                alert(
                    "Please login as admin first."
                );

                return;
            }


            const playerName =
                document.getElementById(
                    "playerName"
                )?.value.trim();


            if (!playerName) {
                return;
            }


            const alreadyExists =
                players.some(function (player) {

                    return player.name.toLowerCase() ===
                        playerName.toLowerCase();

                });


            if (alreadyExists) {

                alert(
                    "This player already exists."
                );

                return;
            }


            const {
                error
            } = await supabaseClient
                .from("players")
                .insert([
                    {
                        name: playerName
                    }
                ]);


            if (error) {

                console.error(error);

                alert(
                    "Could not add player: " +
                    error.message
                );

                return;
            }


            playerForm.reset();

            await loadData();

            alert(
                "Player added successfully."
            );

        }
    );
}


/* =========================================================
   15. ADD MATCH
   ========================================================= */

if (matchForm) {

    matchForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (!currentUser) {

                alert(
                    "Please login as admin first."
                );

                return;
            }


            const type =
                normalizeMatchType(
                    matchType?.value
                );


            const date =
                document.getElementById(
                    "matchDate"
                )?.value;


            const time =
                document.getElementById(
                    "matchTime"
                )?.value;


            const venue =
                document.getElementById(
                    "matchVenue"
                )?.value.trim();


            if (!type || !date || !time || !venue) {

                alert(
                    "Please fill all match details."
                );

                return;
            }


            let matchData = {

                type:
                    type,

                date:
                    date,

                time:
                    time,

                venue:
                    venue,

                status:
                    "Scheduled"

            };


            /* SINGLE WICKET */

            if (type === "single") {

                const playerA =
                    document.getElementById(
                        "singlePlayerA"
                    )?.value;

                const playerB =
                    document.getElementById(
                        "singlePlayerB"
                    )?.value;


                if (!playerA || !playerB) {

                    alert(
                        "Please select both players."
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

            }


            /* DOUBLE WICKET */

            else {

                const a1 =
                    document.getElementById(
                        "doublePlayerA1"
                    )?.value;

                const a2 =
                    document.getElementById(
                        "doublePlayerA2"
                    )?.value;

                const b1 =
                    document.getElementById(
                        "doublePlayerB1"
                    )?.value;

                const b2 =
                    document.getElementById(
                        "doublePlayerB2"
                    )?.value;


                if (!a1 || !a2 || !b1 || !b2) {

                    alert(
                        "Please select all four players."
                    );

                    return;
                }


                const selectedPlayers = [
                    a1,
                    a2,
                    b1,
                    b2
                ];


                const uniquePlayers =
                    new Set(selectedPlayers);


                if (
                    uniquePlayers.size !==
                    selectedPlayers.length
                ) {

                    alert(
                        "The same player cannot be selected twice."
                    );

                    return;
                }


                /*
                   Keep player_a/player_b for compatibility
                   and also save proper JSON arrays.
                */

                matchData.player_a =
                    `${a1} & ${a2}`;

                matchData.player_b =
                    `${b1} & ${b2}`;

                matchData.team_a_players =
                    [a1, a2];

                matchData.team_b_players =
                    [b1, b2];
            }


            const {
                error
            } = await supabaseClient
                .from("matches")
                .insert([
                    matchData
                ]);


            if (error) {

                console.error(error);

                alert(
                    "Could not add match: " +
                    error.message
                );

                return;
            }


            matchForm.reset();

            updateMatchTypeFields();

            await loadData();

            alert(
                "Match added successfully."
            );

        }
    );
}


/* =========================================================
   16. MATCH CARD
   ========================================================= */

function createMatchCard(match) {

    const type =
        normalizeMatchType(match.type);


    const typeLabel =
        type === "single"
            ? "Single Wicket"
            : "Double Wicket";


    const teamA =
        getTeamDisplay(match, "A");


    const teamB =
        getTeamDisplay(match, "B");


    const status =
        match.status || "Scheduled";


    return `
        <div class="match-card">

            <div class="match-card-top">

                <span class="match-type">
                    ${escapeHTML(typeLabel)}
                </span>

                <span class="match-status">
                    ${escapeHTML(status)}
                </span>

            </div>

            <div class="match-teams">

                <div class="match-team">
                    ${escapeHTML(teamA)}
                </div>

                <div class="vs">
                    VS
                </div>

                <div class="match-team">
                    ${escapeHTML(teamB)}
                </div>

            </div>

            <div class="match-info">

                <span>
                    📅 ${escapeHTML(
                        formatLocalDate(match.date)
                    )}
                </span>

                <span>
                    🕒 ${escapeHTML(
                        match.time || ""
                    )}
                </span>

            </div>

            <div class="match-venue">
                📍 ${escapeHTML(
                    match.venue || ""
                )}
            </div>

        </div>
    `;
}


/* =========================================================
   17. TODAY
   ========================================================= */

function renderTodayMatches() {

    const container =
        document.getElementById(
            "todayMatchesContainer"
        );

    if (!container) {
        return;
    }


    const today =
        getTodayString();


    const todayMatches =
        sortMatchesByDateTime(
            matches.filter(function (match) {

                return match.date === today;

            })
        );


    if (todayMatches.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No matches scheduled for today.
            </div>
        `;

        return;
    }


    container.innerHTML =
        todayMatches
            .map(createMatchCard)
            .join("");
}


/* =========================================================
   18. TOMORROW
   ========================================================= */

function renderTomorrowMatches() {

    const container =
        document.getElementById(
            "tomorrowMatchesContainer"
        );

    if (!container) {
        return;
    }


    const tomorrow =
        getTomorrowString();


    const tomorrowMatches =
        sortMatchesByDateTime(
            matches.filter(function (match) {

                return match.date === tomorrow;

            })
        );


    if (tomorrowMatches.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No matches scheduled for tomorrow.
            </div>
        `;

        return;
    }


    container.innerHTML =
        tomorrowMatches
            .map(createMatchCard)
            .join("");
}


/* =========================================================
   19. SINGLE WICKET
   ========================================================= */

function renderSingleWicket() {

    const container =
        document.getElementById(
            "singleWicketContainer"
        );

    if (!container) {
        return;
    }


    const singleMatches =
        sortMatchesByDateTime(
            matches.filter(isSingleMatch)
        );


    if (singleMatches.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No Single Wicket matches available.
            </div>
        `;

        return;
    }


    container.innerHTML =
        singleMatches
            .map(createMatchCard)
            .join("");
}


/* =========================================================
   20. DOUBLE WICKET
   ========================================================= */

function renderDoubleWicket() {

    const container =
        document.getElementById(
            "doubleWicketContainer"
        );

    if (!container) {
        return;
    }


    const doubleMatches =
        sortMatchesByDateTime(
            matches.filter(isDoubleMatch)
        );


    if (doubleMatches.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No Double Wicket matches available.
            </div>
        `;

        return;
    }


    container.innerHTML =
        doubleMatches
            .map(createMatchCard)
            .join("");
}


/* =========================================================
   21. FULL SCHEDULE
   ========================================================= */

function renderFullSchedule() {

    const container =
        document.getElementById(
            "fullScheduleContainer"
        );

    if (!container) {
        return;
    }


    const sortedMatches =
        sortMatchesByDateTime(matches);


    if (sortedMatches.length === 0) {

        container.innerHTML = `
            <tr>
                <td colspan="6">
                    No matches scheduled.
                </td>
            </tr>
        `;

        return;
    }


    container.innerHTML =
        sortedMatches
            .map(function (match) {

                const type =
                    normalizeMatchType(match.type);


                const typeLabel =
                    type === "single"
                        ? "Single Wicket"
                        : "Double Wicket";


                const teamA =
                    getTeamDisplay(match, "A");


                const teamB =
                    getTeamDisplay(match, "B");


                return `
                    <tr>

                        <td>
                            ${escapeHTML(
                                formatLocalDate(match.date)
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                match.time || ""
                            )}
                        </td>

                        <td>
                            <strong>
                                ${escapeHTML(teamA)}
                            </strong>

                            <span>
                                vs
                            </span>

                            <strong>
                                ${escapeHTML(teamB)}
                            </strong>
                        </td>

                        <td>
                            ${escapeHTML(typeLabel)}
                        </td>

                        <td>
                            ${escapeHTML(
                                match.venue || ""
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                match.status ||
                                "Scheduled"
                            )}
                        </td>

                    </tr>
                `;

            })
            .join("");
}


/* =========================================================
   22. RESULT OPTIONS
   ========================================================= */

function renderResultOptions() {

    const resultMatch =
        document.getElementById(
            "resultMatch"
        );

    const winner =
        document.getElementById(
            "winner"
        );

    const playerOfMatch =
        document.getElementById(
            "playerOfMatch"
        );


    if (!resultMatch) {
        return;
    }


    const incompleteMatches =
        matches.filter(function (match) {

            return String(
                match.status || ""
            ).toLowerCase() !== "completed";

        });


    resultMatch.innerHTML = `
        <option value="">
            Select Match
        </option>
    `;


    incompleteMatches.forEach(function (match) {

        const option =
            document.createElement("option");

        option.value =
            match.id;

        option.textContent =
            `${formatLocalDate(match.date)} — ${getTeamDisplay(match, "A")} vs ${getTeamDisplay(match, "B")}`;

        resultMatch.appendChild(
            option
        );

    });


    if (winner) {

        winner.innerHTML = `
            <option value="">
                Select Winner
            </option>
        `;

        winner.disabled = true;
    }


    if (playerOfMatch) {

        playerOfMatch.innerHTML = `
            <option value="">
                Select Player of the Match
            </option>
        `;

        playerOfMatch.disabled = true;
    }
}


/* =========================================================
   23. WHEN RESULT MATCH CHANGES
   ========================================================= */

const resultMatchSelect =
    document.getElementById(
        "resultMatch"
    );


if (resultMatchSelect) {

    resultMatchSelect.addEventListener(
        "change",
        function () {

            const selectedId =
                resultMatchSelect.value;


            const winner =
                document.getElementById(
                    "winner"
                );


            const playerOfMatch =
                document.getElementById(
                    "playerOfMatch"
                );


            if (winner) {

                winner.innerHTML = `
                    <option value="">
                        Select Winner
                    </option>
                `;
            }


            if (playerOfMatch) {

                playerOfMatch.innerHTML = `
                    <option value="">
                        Select Player of the Match
                    </option>
                `;
            }


            if (!selectedId) {

                if (winner) {
                    winner.disabled = true;
                }

                if (playerOfMatch) {
                    playerOfMatch.disabled = true;
                }

                return;
            }


            const match =
                matches.find(function (item) {

                    return String(item.id) ===
                        String(selectedId);

                });


            if (!match) {

                if (winner) {
                    winner.disabled = true;
                }

                if (playerOfMatch) {
                    playerOfMatch.disabled = true;
                }

                return;
            }


            const teamA =
                getTeamDisplay(match, "A");


            const teamB =
                getTeamDisplay(match, "B");


            /* WINNER OPTIONS */

            if (winner) {

                winner.disabled = false;


                const optionA =
                    document.createElement("option");

                optionA.value =
                    teamA;

                optionA.textContent =
                    teamA;


                const optionB =
                    document.createElement("option");

                optionB.value =
                    teamB;

                optionB.textContent =
                    teamB;


                winner.appendChild(
                    optionA
                );

                winner.appendChild(
                    optionB
                );
            }


            /* PLAYER OF MATCH OPTIONS */

            if (playerOfMatch) {

                const playersForMatch =
                    getMatchPlayers(match);


                playersForMatch.forEach(
                    function (name) {

                        const option =
                            document.createElement(
                                "option"
                            );

                        option.value =
                            name;

                        option.textContent =
                            name;

                        playerOfMatch.appendChild(
                            option
                        );

                    }
                );


                playerOfMatch.disabled =
                    playersForMatch.length === 0;
            }

        }
    );
}


/* =========================================================
   24. ADD RESULT
   ========================================================= */

if (resultForm) {

    resultForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (!currentUser) {

                alert(
                    "Please login as admin first."
                );

                return;
            }


            const matchId =
                document.getElementById(
                    "resultMatch"
                )?.value;


            const winner =
                document.getElementById(
                    "winner"
                )?.value.trim();


            const score =
                document.getElementById(
                    "score"
                )?.value.trim();


            const playerOfMatch =
                document.getElementById(
                    "playerOfMatch"
                )?.value;


            if (
                !matchId ||
                !winner ||
                !score ||
                !playerOfMatch
            ) {

                alert(
                    "Please complete all result fields."
                );

                return;
            }


            const match =
                matches.find(function (item) {

                    return String(item.id) ===
                        String(matchId);

                });


            if (!match) {

                alert(
                    "Match not found."
                );

                return;
            }


            const teamA =
                getTeamDisplay(match, "A");


            const teamB =
                getTeamDisplay(match, "B");


            const loser =
                winner === teamA
                    ? teamB
                    : teamA;


            /*
               Save result.
            */

            const {
                error: resultError
            } = await supabaseClient
                .from("results")
                .insert([
                    {
                        match_id: match.id,
                        winner_team: winner,
                        winner: winner,
                        loser: loser,
                        score: score,
                        player_of_match: playerOfMatch
                    }
                ]);


            if (resultError) {

                console.error(resultError);

                alert(
                    "Could not save result: " +
                    resultError.message
                );

                return;
            }


            /*
               Mark match completed.
            */

            const {
                error: matchError
            } = await supabaseClient
                .from("matches")
                .update({
                    status: "Completed"
                })
                .eq("id", match.id);


            if (matchError) {

                console.error(matchError);

                alert(
                    "Result saved, but match status could not be updated: " +
                    matchError.message
                );

                return;
            }


            /*
               Add win to winning players.
            */

            await addWinToPlayers(
                match,
                winner
            );


            resultForm.reset();

            await loadData();

            alert(
                "Match result saved successfully."
            );

        }
    );
}


/* =========================================================
   25. ADD WIN TO PLAYERS
   ========================================================= */

async function addWinToPlayers(
    match,
    winnerInput
) {

    if (!match || !winnerInput) {
        return;
    }


    let winningPlayers = [];


    const teamA =
        getTeamDisplay(
            match,
            "A"
        );


    const teamB =
        getTeamDisplay(
            match,
            "B"
        );


    if (winnerInput === teamA) {

        if (isSingleMatch(match)) {

            winningPlayers = [
                match.player_a
            ];

        } else if (
            Array.isArray(match.team_a_players)
        ) {

            winningPlayers =
                [...match.team_a_players];

        } else {

            winningPlayers =
                String(match.player_a || "")
                    .split("&")
                    .map(function (name) {
                        return name.trim();
                    });
        }


    } else if (winnerInput === teamB) {

        if (isSingleMatch(match)) {

            winningPlayers = [
                match.player_b
            ];

        } else if (
            Array.isArray(match.team_b_players)
        ) {

            winningPlayers =
                [...match.team_b_players];

        } else {

            winningPlayers =
                String(match.player_b || "")
                    .split("&")
                    .map(function (name) {
                        return name.trim();
                    });
        }
    }


    for (
        const playerName of winningPlayers
    ) {

        if (!playerName) {
            continue;
        }


        const existing =
            stats.find(function (item) {

                return String(
                    item.player
                ).toLowerCase() ===
                String(playerName)
                    .toLowerCase();

            });


        if (existing) {

            const {
                error
            } = await supabaseClient
                .from("stats")
                .update({
                    wins:
                        Number(existing.wins || 0) + 1
                })
                .eq(
                    "player",
                    existing.player
                );


            if (error) {
                console.error(
                    "Could not update player win:",
                    error
                );
            }

        } else {

            const {
                error
            } = await supabaseClient
                .from("stats")
                .insert([
                    {
                        player:
                            playerName,

                        runs:
                            0,

                        wickets:
                            0,

                        wins:
                            1
                    }
                ]);


            if (error) {
                console.error(
                    "Could not create player stats:",
                    error
                );
            }
        }
    }
}


/* =========================================================
   26. RESULTS DISPLAY
   ========================================================= */

function renderResults() {

    const container =
        document.getElementById(
            "resultsContainer"
        );


    if (!container) {
        return;
    }


    if (results.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                No results available yet.
            </div>
        `;

        return;
    }


    container.innerHTML =
        results
            .map(function (result) {

                const match =
                    matches.find(function (item) {

                        return String(item.id) ===
                            String(result.match_id);

                    });


                const typeLabel =
                    match
                        ? (
                            isSingleMatch(match)
                                ? "Single Wicket"
                                : "Double Wicket"
                        )
                        : "";


                return `
                    <div class="result-card">

                        <div class="result-top">

                            <span>
                                ${escapeHTML(
                                    typeLabel
                                )}
                            </span>

                            <span>
                                ✓ Completed
                            </span>

                        </div>

                        <div class="result-main">

                            <div class="result-winner">

                                🏆
                                ${escapeHTML(
                                    result.winner ||
                                    result.winner_team ||
                                    ""
                                )}

                            </div>

                            <div class="result-score">

                                ${escapeHTML(
                                    result.score || ""
                                )}

                            </div>

                        </div>

                        <div class="result-details">

                            <p>
                                Runner-up:
                                ${escapeHTML(
                                    result.loser || ""
                                )}
                            </p>

                            <p>
                                Player of the Match:
                                <strong>
                                    ${escapeHTML(
                                        result.player_of_match ||
                                        "—"
                                    )}
                                </strong>
                            </p>

                        </div>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   27. SAVE / UPDATE STATS
   ========================================================= */

if (statsForm) {

    statsForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (!currentUser) {

                alert(
                    "Please login as admin first."
                );

                return;
            }


            const player =
                document.getElementById(
                    "statsPlayer"
                )?.value;


            const runs =
                Number(
                    document.getElementById(
                        "runs"
                    )?.value || 0
                );


            const wickets =
                Number(
                    document.getElementById(
                        "wickets"
                    )?.value || 0
                );


            const wins =
                Number(
                    document.getElementById(
                        "wins"
                    )?.value || 0
                );


            if (!player) {

                alert(
                    "Please select a player."
                );

                return;
            }


            const existing =
                stats.find(function (item) {

                    return String(
                        item.player
                    ).toLowerCase() ===
                    String(player).toLowerCase();

                });


            let error;


            if (existing) {

                const response =
                    await supabaseClient
                        .from("stats")
                        .update({
                            runs:
                                runs,

                            wickets:
                                wickets,

                            wins:
                                wins
                        })
                        .eq(
                            "player",
                            existing.player
                        );

                error =
                    response.error;

            } else {

                const response =
                    await supabaseClient
                        .from("stats")
                        .insert([
                            {
                                player:
                                    player,

                                runs:
                                    runs,

                                wickets:
                                    wickets,

                                wins:
                                    wins
                            }
                        ]);

                error =
                    response.error;
            }


            if (error) {

                console.error(error);

                alert(
                    "Could not save statistics: " +
                    error.message
                );

                return;
            }


            statsForm.reset();

            await loadData();

            alert(
                "Player statistics saved successfully."
            );

        }
    );
}


/* =========================================================
   28. STATS DISPLAY
   ========================================================= */

function renderStats() {

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


    if (stats.length === 0) {

        if (topScorer) {
            topScorer.textContent = "—";
        }

        if (topScorerRuns) {
            topScorerRuns.textContent =
                "Runs: 0";
        }

        if (bestBowler) {
            bestBowler.textContent = "—";
        }

        if (bestBowlerWickets) {
            bestBowlerWickets.textContent =
                "Wickets: 0";
        }

        if (mostWins) {
            mostWins.textContent = "—";
        }

        if (mostWinsCount) {
            mostWinsCount.textContent =
                "Wins: 0";
        }

        return;
    }


    const scorer =
        [...stats].sort(function (a, b) {

            return Number(b.runs || 0) -
                Number(a.runs || 0);

        })[0];


    const bowler =
        [...stats].sort(function (a, b) {

            return Number(b.wickets || 0) -
                Number(a.wickets || 0);

        })[0];


    const winner =
        [...stats].sort(function (a, b) {

            return Number(b.wins || 0) -
                Number(a.wins || 0);

        })[0];


    if (topScorer) {

        topScorer.textContent =
            scorer?.player || "—";
    }


    if (topScorerRuns) {

        topScorerRuns.textContent =
            `Runs: ${Number(
                scorer?.runs || 0
            )}`;
    }


    if (bestBowler) {

        bestBowler.textContent =
            bowler?.player || "—";
    }


    if (bestBowlerWickets) {

        bestBowlerWickets.textContent =
            `Wickets: ${Number(
                bowler?.wickets || 0
            )}`;
    }


    if (mostWins) {

        mostWins.textContent =
            winner?.player || "—";
    }


    if (mostWinsCount) {

        mostWinsCount.textContent =
            `Wins: ${Number(
                winner?.wins || 0
            )}`;
    }
}


/* =========================================================
   29. PLAYER CARDS
   ========================================================= */

function renderPlayers() {

    if (!playersContainer) {
        return;
    }


    if (players.length === 0) {

        playersContainer.innerHTML = `
            <div class="empty-state">
                No players registered yet.
            </div>
        `;

        return;
    }


    playersContainer.innerHTML =
        players
            .map(function (player) {

                const playerStats =
                    stats.find(function (item) {

                        return String(
                            item.player
                        ).toLowerCase() ===
                        String(player.name)
                            .toLowerCase();

                    });


                const runs =
                    Number(
                        playerStats?.runs || 0
                    );


                const wickets =
                    Number(
                        playerStats?.wickets || 0
                    );


                const wins =
                    Number(
                        playerStats?.wins || 0
                    );


                const deleteButton =
                    currentUser
                        ? `
                            <button
                                type="button"
                                class="delete-player-btn"
                                data-player-id="${escapeHTML(
                                    player.id
                                )}"
                                data-player-name="${escapeHTML(
                                    player.name
                                )}"
                            >
                                🗑️ Delete Player
                            </button>
                        `
                        : "";


                return `
                    <div class="player-card">

                        <div class="player-avatar">

                            ${escapeHTML(
                                player.name
                                    .charAt(0)
                                    .toUpperCase()
                            )}

                        </div>

                        <h3>
                            ${escapeHTML(
                                player.name
                            )}
                        </h3>

                        <div class="player-stats">

                            <div>

                                <strong>
                                    ${runs}
                                </strong>

                                <span>
                                    Runs
                                </span>

                            </div>

                            <div>

                                <strong>
                                    ${wickets}
                                </strong>

                                <span>
                                    Wickets
                                </span>

                            </div>

                            <div>

                                <strong>
                                    ${wins}
                                </strong>

                                <span>
                                    Wins
                                </span>

                            </div>

                        </div>

                        ${deleteButton}

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   30. DELETE PLAYER
   ========================================================= */

async function deletePlayer(
    playerId,
    playerName
) {

    if (!currentUser) {

        alert(
            "Please login as admin first."
        );

        return;
    }


    const targetName =
        String(playerName)
            .trim()
            .toLowerCase();


    /*
       Check both Single and Double matches.
    */

    const usedInMatch =
        matches.some(function (match) {

            let names = [];


            if (match.player_a) {

                names.push(
                    ...String(match.player_a)
                        .split("&")
                        .map(function (name) {
                            return name.trim();
                        })
                );
            }


            if (match.player_b) {

                names.push(
                    ...String(match.player_b)
                        .split("&")
                        .map(function (name) {
                            return name.trim();
                        })
                );
            }


            if (
                Array.isArray(
                    match.team_a_players
                )
            ) {

                names.push(
                    ...match.team_a_players
                );
            }


            if (
                Array.isArray(
                    match.team_b_players
                )
            ) {

                names.push(
                    ...match.team_b_players
                );
            }


            return names.some(function (name) {

                return String(name)
                    .trim()
                    .toLowerCase() ===
                    targetName;

            });

        });


    if (usedInMatch) {

        alert(
            "This player cannot be deleted because they are already used in a match."
        );

        return;
    }


    const confirmed =
        confirm(
            `Are you sure you want to delete "${playerName}"?`
        );


    if (!confirmed) {
        return;
    }


    const {
        error: statsError
    } = await supabaseClient
        .from("stats")
        .delete()
        .eq(
            "player",
            playerName
        );


    if (statsError) {

        console.error(statsError);

        alert(
            "Could not delete player statistics: " +
            statsError.message
        );

        return;
    }


    const {
        error: playerError
    } = await supabaseClient
        .from("players")
        .delete()
        .eq(
            "id",
            playerId
        );


    if (playerError) {

        console.error(playerError);

        alert(
            "Could not delete player: " +
            playerError.message
        );

        return;
    }


    await loadData();

    alert(
        "Player deleted successfully."
    );
}


/* =========================================================
   31. PLAYER DELETE BUTTON EVENT
   ========================================================= */

if (playersContainer) {

    playersContainer.addEventListener(
        "click",
        function (event) {

            const button =
                event.target.closest(
                    ".delete-player-btn"
                );


            if (!button) {
                return;
            }


            deletePlayer(
                button.dataset.playerId,
                button.dataset.playerName
            );

        }
    );
}


/* =========================================================
   32. RESET TOURNAMENT
   ========================================================= */

if (resetTournamentBtn) {

    resetTournamentBtn.addEventListener(
        "click",
        async function () {

            if (!currentUser) {

                alert(
                    "Please login as admin first."
                );

                return;
            }


            const firstConfirm =
                confirm(
                    "WARNING!\n\nThis will delete all players, matches, results and statistics.\n\nYour admin account and website design will NOT be deleted.\n\nContinue?"
                );


            if (!firstConfirm) {
                return;
            }


            const secondConfirm =
                confirm(
                    "FINAL CONFIRMATION!\n\nAre you absolutely sure you want to reset all tournament data?"
                );


            if (!secondConfirm) {
                return;
            }


            resetTournamentBtn.disabled =
                true;

            resetTournamentBtn.textContent =
                "Resetting...";


            try {

                let response;


                /* RESULTS */

                response =
                    await supabaseClient
                        .from("results")
                        .delete()
                        .neq(
                            "id",
                            -1
                        );


                if (response.error) {
                    throw response.error;
                }


                /* MATCHES */

                response =
                    await supabaseClient
                        .from("matches")
                        .delete()
                        .neq(
                            "id",
                            -1
                        );


                if (response.error) {
                    throw response.error;
                }


                /* STATS */

                response =
                    await supabaseClient
                        .from("stats")
                        .delete()
                        .neq(
                            "player",
                            "__never__"
                        );


                if (response.error) {
                    throw response.error;
                }


                /* PLAYERS */

                response =
                    await supabaseClient
                        .from("players")
                        .delete()
                        .neq(
                            "id",
                            -1
                        );


                if (response.error) {
                    throw response.error;
                }


                players = [];
                matches = [];
                results = [];
                stats = [];


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
                    "Reset failed: " +
                    error.message
                );

            } finally {

                resetTournamentBtn.disabled =
                    false;

                resetTournamentBtn.textContent =
                    "🗑️ Reset Tournament Data";
            }

        }
    );
}


/* =========================================================
   33. START WEBSITE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async function () {

        updateMatchTypeFields();

        await loadData();


        const {
            data
        } = await supabaseClient.auth.getSession();


        if (data?.session?.user) {

            const isAdmin =
                await verifyAdmin(
                    data.session.user.email
                );


            if (isAdmin) {

                currentUser =
                    data.session.user;

                showAdminPanel();

            }

        }

    }
);


/* =========================================================
   34. AUTO REFRESH
   ========================================================= */

setInterval(
    async function () {

        await loadData();

    },
    60000
);