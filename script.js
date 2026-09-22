// ========================================
// CROSS CRICKET
// SUPABASE VERSION - FIXED
// ========================================


// ========================================
// SUPABASE CONFIG
// ========================================

const SUPABASE_URL =
    "https://zgenbnkzoxxacrrsjibj.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_zHZKaQ7Lpkrzbt7_Ebh-vQ_zfIUX3Aj";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


// ========================================
// DEFAULT PLAYERS
// ========================================

const defaultPlayers = [
    "Ansar",
    "Danish",
    "Bilawal",
    "Abubakkar",
    "Muzakkir",
    "Jahanzeb",
    "Uzair"
];


// ========================================
// DATA
// ========================================

let savedPlayers = [];
let savedMatches = [];
let savedResults = [];
let savedStats = [];

let currentUser = null;
let isAdmin = false;


// ========================================
// HELPERS
// ========================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function formatLocalDate(date) {

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, "0");

    const day =
        String(
            date.getDate()
        ).padStart(2, "0");

    return `${year}-${month}-${day}`;

}


// ========================================
// PLAYERS
// ========================================

function getAllPlayers() {

    const databaseNames =
        savedPlayers.map(
            player => player.name
        );

    return [
        ...new Set([
            ...defaultPlayers,
            ...databaseNames
        ])
    ].sort(
        (a, b) =>
            a.localeCompare(b)
    );

}


function getPlayerNames(match) {

    if (!match) {
        return [];
    }

    if (
        match.type ===
        "Single Wicket"
    ) {

        return [
            match.player_a,
            match.player_b
        ].filter(Boolean);

    }

    return [
        ...(match.team_a_players || []),
        ...(match.team_b_players || [])
    ].filter(Boolean);

}


function getTeamDisplay(
    match,
    team
) {

    if (
        match.type ===
        "Single Wicket"
    ) {

        return team === "A"
            ? match.player_a
            : match.player_b;

    }

    const players =
        team === "A"
            ? match.team_a_players || []
            : match.team_b_players || [];

    return players.join(" + ");

}


// ========================================
// DATABASE
// ========================================

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
                .order("name"),

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
                .order("player")

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


        savedPlayers =
            playersResponse.data || [];

        savedMatches =
            matchesResponse.data || [];

        savedResults =
            resultsResponse.data || [];

        savedStats =
            statsResponse.data || [];


        renderEverything();

    }
    catch (error) {

        console.error(
            "Database loading error:",
            error
        );

        showDatabaseError(
            error.message
        );

    }

}


function showDatabaseError(message) {

    const containers = [

        document.getElementById(
            "todayMatchesContainer"
        ),

        document.getElementById(
            "tomorrowMatchesContainer"
        ),

        document.getElementById(
            "playersContainer"
        )

    ];


    containers.forEach(
        container => {

            if (!container) {
                return;
            }

            container.innerHTML = `

                <div class="match-card error-card">

                    <h3>
                        Database connection problem
                    </h3>

                    <p>
                        ${escapeHTML(message)}
                    </p>

                </div>

            `;

        }
    );

}


// ========================================
// RENDER EVERYTHING
// ========================================

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


// ========================================
// PLAYER SELECTS
// ========================================

function fillPlayerSelect(
    selectId,
    placeholder
) {

    const select =
        document.getElementById(
            selectId
        );

    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            ${placeholder}
        </option>
    `;


    getAllPlayers().forEach(
        playerName => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                playerName;

            option.textContent =
                playerName;

            select.appendChild(
                option
            );

        }
    );

}


function loadAllPlayerDropdowns() {

    fillPlayerSelect(
        "singlePlayerA",
        "Select Player 1"
    );

    fillPlayerSelect(
        "singlePlayerB",
        "Select Player 2"
    );

    fillPlayerSelect(
        "doublePlayerA1",
        "Select Player 1"
    );

    fillPlayerSelect(
        "doublePlayerA2",
        "Select Player 2"
    );

    fillPlayerSelect(
        "doublePlayerB1",
        "Select Player 1"
    );

    fillPlayerSelect(
        "doublePlayerB2",
        "Select Player 2"
    );

    fillPlayerSelect(
        "statsPlayer",
        "Select Player"
    );

}


// ========================================
// ADMIN AUTH
// ========================================

async function checkAdmin() {

    const {
        data: {
            session
        }
    } =
        await supabaseClient.auth.getSession();


    if (!session) {

        currentUser = null;
        isAdmin = false;

        hideAdminPanel();

        return;

    }


    currentUser =
        session.user;

    await verifyAdmin();

}


async function verifyAdmin() {

    if (!currentUser) {

        isAdmin = false;

        hideAdminPanel();

        return;

    }


    const email =
        currentUser.email;


    const {
        data,
        error
    } =
        await supabaseClient
            .from("admin_users")
            .select("email")
            .ilike(
                "email",
                email
            )
            .maybeSingle();


    if (error) {

        console.error(
            "Admin verification error:",
            error
        );

        isAdmin = false;

        hideAdminPanel();

        return;

    }


    if (data) {

        isAdmin = true;

        showAdminPanel();

    }
    else {

        isAdmin = false;

        hideAdminPanel();

        await supabaseClient.auth.signOut();

        alert(
            "This account is not authorized as an admin."
        );

    }

}


// ========================================
// LOGIN MODAL
// ========================================

const loginModal =
    document.getElementById(
        "loginModal"
    );

const adminLoginBtn =
    document.getElementById(
        "adminLoginBtn"
    );

const footerAdminBtn =
    document.getElementById(
        "footerAdminBtn"
    );

const closeLogin =
    document.getElementById(
        "closeLogin"
    );


function openLoginModal() {

    if (!loginModal) {
        return;
    }

    loginModal.classList.add(
        "show"
    );

    setTimeout(
        function () {

            document
                .getElementById("loginEmail")
                ?.focus();

        },
        100
    );

}


function closeLoginModal() {

    if (!loginModal) {
        return;
    }

    loginModal.classList.remove(
        "show"
    );

}


if (adminLoginBtn) {

    adminLoginBtn.addEventListener(
        "click",
        function () {

            openLoginModal();

        }
    );

}


if (footerAdminBtn) {

    footerAdminBtn.addEventListener(
        "click",
        function () {

            openLoginModal();

        }
    );

}


if (closeLogin) {

    closeLogin.addEventListener(
        "click",
        function () {

            closeLoginModal();

        }
    );

}


if (loginModal) {

    loginModal.addEventListener(
        "click",
        function (event) {

            if (
                event.target ===
                loginModal
            ) {

                closeLoginModal();

            }

        }
    );

}


document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Escape"
        ) {

            closeLoginModal();

        }

    }
);


// ========================================
// LOGIN
// ========================================

const loginForm =
    document.getElementById(
        "loginForm"
    );


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            const email =
                document
                    .getElementById(
                        "loginEmail"
                    )
                    .value
                    .trim();


            const password =
                document
                    .getElementById(
                        "loginPassword"
                    )
                    .value;


            const message =
                document.getElementById(
                    "loginMessage"
                );


            message.textContent =
                "Logging in...";

            message.className =
                "login-message";


            const {
                data,
                error
            } =
                await supabaseClient.auth
                    .signInWithPassword({

                        email:
                            email,

                        password:
                            password

                    });


            if (error) {

                console.error(
                    error
                );

                message.textContent =
                    error.message;

                message.className =
                    "login-message error";

                return;

            }


            currentUser =
                data.user;


            await verifyAdmin();


            if (isAdmin) {

                message.textContent =
                    "Login successful!";

                message.className =
                    "login-message success";


                setTimeout(
                    function () {

                        closeLoginModal();

                        loginForm.reset();

                        message.textContent =
                            "";

                    },
                    700
                );

            }

        }
    );

}


// ========================================
// AUTH STATE
// ========================================

supabaseClient.auth.onAuthStateChange(
    function (event, session) {

        setTimeout(
            async function () {

                if (session) {

                    currentUser =
                        session.user;

                    await verifyAdmin();

                }
                else {

                    currentUser = null;
                    isAdmin = false;

                    hideAdminPanel();

                }

            },
            0
        );

    }
);


// ========================================
// ADMIN PANEL
// ========================================

function showAdminPanel() {

    const admin =
        document.getElementById(
            "admin"
        );

    if (!admin) {
        return;
    }

    admin.style.display =
        "block";

}


function hideAdminPanel() {

    const admin =
        document.getElementById(
            "admin"
        );

    if (!admin) {
        return;
    }

    admin.style.display =
        "none";

}


// ========================================
// LOGOUT
// ========================================

const logoutBtn =
    document.getElementById(
        "logoutBtn"
    );


if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        async function () {

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


// ========================================
// ADD PLAYER
// ========================================

const playerForm =
    document.getElementById(
        "playerForm"
    );


if (playerForm) {

    playerForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            if (!isAdmin) {

                alert(
                    "Admin login required."
                );

                return;

            }


            const input =
                document.getElementById(
                    "playerName"
                );


            const playerName =
                input.value.trim();


            if (!playerName) {
                return;
            }


            const alreadyExists =
                getAllPlayers().some(
                    name =>
                        name.toLowerCase() ===
                        playerName.toLowerCase()
                );


            if (alreadyExists) {

                alert(
                    "This player already exists!"
                );

                return;

            }


            const {
                error
            } =
                await supabaseClient
                    .from("players")
                    .insert({

                        name:
                            playerName

                    });


            if (error) {

                alert(
                    "Could not add player: " +
                    error.message
                );

                return;

            }


            playerForm.reset();

            await loadDatabase();

            alert(
                playerName +
                " has been added successfully!"
            );

        }
    );

}


// ========================================
// MATCH TYPE
// ========================================

const matchType =
    document.getElementById(
        "matchType"
    );


if (matchType) {

    matchType.addEventListener(
        "change",
        function () {

            const singleFields =
                document.getElementById(
                    "singleMatchFields"
                );

            const doubleFields =
                document.getElementById(
                    "doubleMatchFields"
                );


            if (
                this.value ===
                "Double Wicket"
            ) {

                singleFields.style.display =
                    "none";

                doubleFields.style.display =
                    "block";

            }
            else {

                singleFields.style.display =
                    "block";

                doubleFields.style.display =
                    "none";

            }

            updateResultWinnerOptions();

        }
    );

}


// ========================================
// ADD MATCH
// ========================================

const matchForm =
    document.getElementById(
        "matchForm"
    );


if (matchForm) {

    matchForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();


            if (!isAdmin) {

                alert(
                    "Admin login required."
                );

                return;

            }


            const type =
                document.getElementById(
                    "matchType"
                ).value;


            const date =
                document.getElementById(
                    "matchDate"
                ).value;


            const time =
                document.getElementById(
                    "matchTime"
                ).value;


            const venue =
                document.getElementById(
                    "matchVenue"
                ).value.trim();


            if (!type) {

                alert(
                    "Please select match type."
                );

                return;

            }


            const match = {

                type: type,

                date: date,

                time: time,

                venue: venue,

                status: "Upcoming"

            };


            if (
                type ===
                "Single Wicket"
            ) {

                const playerA =
                    document.getElementById(
                        "singlePlayerA"
                    ).value;


                const playerB =
                    document.getElementById(
                        "singlePlayerB"
                    ).value;


                if (
                    !playerA ||
                    !playerB
                ) {

                    alert(
                        "Please select both players."
                    );

                    return;

                }


                if (
                    playerA ===
                    playerB
                ) {

                    alert(
                        "A player cannot play against himself."
                    );

                    return;

                }


                match.player_a =
                    playerA;

                match.player_b =
                    playerB;

                match.team_a_players =
                    [playerA];

                match.team_b_players =
                    [playerB];

            }


            if (
                type ===
                "Double Wicket"
            ) {

                const a1 =
                    document.getElementById(
                        "doublePlayerA1"
                    ).value;

                const a2 =
                    document.getElementById(
                        "doublePlayerA2"
                    ).value;

                const b1 =
                    document.getElementById(
                        "doublePlayerB1"
                    ).value;

                const b2 =
                    document.getElementById(
                        "doublePlayerB2"
                    ).value;


                if (
                    !a1 ||
                    !a2 ||
                    !b1 ||
                    !b2
                ) {

                    alert(
                        "Please select all 4 players."
                    );

                    return;

                }


                const players = [
                    a1,
                    a2,
                    b1,
                    b2
                ];


                if (
                    new Set(players).size !==
                    4
                ) {

                    alert(
                        "Each player must be different."
                    );

                    return;

                }


                match.team_a_players =
                    [a1, a2];

                match.team_b_players =
                    [b1, b2];

            }


            const {
                error
            } =
                await supabaseClient
                    .from("matches")
                    .insert(match);


            if (error) {

                alert(
                    "Could not add match: " +
                    error.message
                );

                return;

            }


            matchForm.reset();


            document.getElementById(
                "singleMatchFields"
            ).style.display =
                "block";


            document.getElementById(
                "doubleMatchFields"
            ).style.display =
                "none";


            await loadDatabase();


            alert(
                "Match successfully added!"
            );

        }
    );

}


// ========================================
// TODAY + TOMORROW
// ========================================

function renderMatches() {

    const todayContainer =
        document.getElementById(
            "todayMatchesContainer"
        );

    const tomorrowContainer =
        document.getElementById(
            "tomorrowMatchesContainer"
        );


    const today =
        new Date();


    const todayString =
        formatLocalDate(
            today
        );


    const tomorrow =
        new Date();


    tomorrow.setDate(
        tomorrow.getDate() + 1
    );


    const tomorrowString =
        formatLocalDate(
            tomorrow
        );


    const todayMatches =
        savedMatches.filter(
            match =>
                match.date ===
                todayString
        );


    const tomorrowMatches =
        savedMatches.filter(
            match =>
                match.date ===
                tomorrowString
        );


    if (todayContainer) {

        renderMatchList(
            todayContainer,
            todayMatches,
            "No matches today"
        );

    }


    if (tomorrowContainer) {

        renderMatchList(
            tomorrowContainer,
            tomorrowMatches,
            "No matches tomorrow"
        );

    }

}


// ========================================
// MATCH LIST
// ========================================

function renderMatchList(
    container,
    matches,
    emptyMessage
) {

    container.innerHTML = "";


    if (
        matches.length === 0
    ) {

        container.innerHTML = `

            <div class="match-card empty-card">

                <div class="empty-icon">
                    🏏
                </div>

                <h3>
                    ${emptyMessage}
                </h3>

                <p>
                    No fixture is scheduled for this date.
                </p>

            </div>

        `;

        return;

    }


    matches.forEach(
        match => {

            container.appendChild(
                createMatchCard(match)
            );

        }
    );

}


// ========================================
// MATCH CARD
// ========================================

function createMatchCard(match) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "match-card";


    const isSingle =
        match.type ===
        "Single Wicket";


    card.innerHTML = `

        <div class="match-top">

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

            <span class="match-time">
                ${escapeHTML(match.time)}
            </span>

        </div>


        <div class="players">

            <div>
                <strong>
                    ${escapeHTML(
                        getTeamDisplay(
                            match,
                            "A"
                        )
                    )}
                </strong>
            </div>

            <span>VS</span>

            <div>
                <strong>
                    ${escapeHTML(
                        getTeamDisplay(
                            match,
                            "B"
                        )
                    )}
                </strong>
            </div>

        </div>


        <div class="match-info">

            📅 ${escapeHTML(match.date)}

            <br>

            📍 ${escapeHTML(match.venue)}

        </div>


        <div class="status ${
            match.status === "Completed"
                ? "completed"
                : "upcoming"
        }">

            ${escapeHTML(match.status)}

        </div>

    `;


    return card;

}


// ========================================
// SINGLE / DOUBLE
// ========================================

function renderSingleDoubleWickets() {

    const singleContainer =
        document.getElementById(
            "singleWicketContainer"
        );

    const doubleContainer =
        document.getElementById(
            "doubleWicketContainer"
        );


    const singleMatches =
        savedMatches.filter(
            match =>
                match.type ===
                "Single Wicket"
        );


    const doubleMatches =
        savedMatches.filter(
            match =>
                match.type ===
                "Double Wicket"
        );


    if (singleContainer) {

        renderMatchList(
            singleContainer,
            singleMatches,
            "No Single Wicket matches"
        );

    }


    if (doubleContainer) {

        renderMatchList(
            doubleContainer,
            doubleMatches,
            "No Double Wicket matches"
        );

    }

}


// ========================================
// RESULT MATCH OPTIONS
// ========================================

function loadMatchOptions() {

    const select =
        document.getElementById(
            "resultMatch"
        );


    if (!select) {
        return;
    }


    select.innerHTML = `
        <option value="">
            Select Match
        </option>
    `;


    savedMatches
        .filter(
            match =>
                match.status !==
                "Completed"
        )
        .forEach(
            match => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    match.id;


                option.textContent =
                    `${getTeamDisplay(match, "A")} vs ${getTeamDisplay(match, "B")} - ${match.date}`;


                select.appendChild(
                    option
                );

            }
        );

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


// ========================================
// WINNER OPTIONS
// ========================================

function updateResultWinnerOptions() {

    const matchId =
        document.getElementById(
            "resultMatch"
        )?.value;


    const winnerSelect =
        document.getElementById(
            "winner"
        );


    const pomSelect =
        document.getElementById(
            "playerOfMatch"
        );


    if (!winnerSelect) {
        return;
    }


    winnerSelect.innerHTML = `
        <option value="">
            Select Winner
        </option>
    `;


    if (pomSelect) {

        pomSelect.innerHTML = `
            <option value="">
                Select Player of the Match
            </option>
        `;

    }


    const match =
        savedMatches.find(
            item =>
                item.id == matchId
        );


    if (!match) {
        return;
    }


    const teamA =
        document.createElement(
            "option"
        );

    teamA.value =
        "A";

    teamA.textContent =
        "Team A — " +
        getTeamDisplay(
            match,
            "A"
        );


    winnerSelect.appendChild(
        teamA
    );


    const teamB =
        document.createElement(
            "option"
        );

    teamB.value =
        "B";

    teamB.textContent =
        "Team B — " +
        getTeamDisplay(
            match,
            "B"
        );


    winnerSelect.appendChild(
        teamB
    );


    if (pomSelect) {

        getPlayerNames(match)
            .forEach(
                playerName => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        playerName;

                    option.textContent =
                        playerName;

                    pomSelect.appendChild(
                        option
                    );

                }
            );

    }

}


// ========================================
// RESULT
// ========================================

function hasResultForMatch(
    matchId
) {

    return savedResults.some(
        result =>
            result.match_id ==
            matchId
    );

}


async function ensurePlayerStats(
    playerName
) {

    const existing =
        savedStats.find(
            stat =>
                stat.player ===
                playerName
        );


    if (existing) {
        return existing;
    }


    const {
        data,
        error
    } =
        await supabaseClient
            .from("stats")
            .insert({

                player:
                    playerName,

                runs: 0,

                wickets: 0,

                wins: 0

            })
            .select()
            .single();


    if (error) {

        console.error(
            error
        );

        return null;

    }


    savedStats.push(
        data
    );

    return data;

}


const resultForm =
    document.getElementById(
        "resultForm"
    );


if (resultForm) {

    resultForm.addEventListener(
        "submit",
        async function (event) {

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
                ).value;


            const winnerTeam =
                document.getElementById(
                    "winner"
                ).value;


            const score =
                document.getElementById(
                    "score"
                ).value.trim();


            const playerOfMatch =
                document.getElementById(
                    "playerOfMatch"
                ).value;


            if (
                !matchId ||
                !winnerTeam ||
                !score ||
                !playerOfMatch
            ) {

                alert(
                    "Please complete all result fields."
                );

                return;

            }


            if (
                hasResultForMatch(
                    matchId
                )
            ) {

                alert(
                    "This match already has a result."
                );

                return;

            }


            const match =
                savedMatches.find(
                    item =>
                        item.id == matchId
                );


            if (!match) {

                alert(
                    "Match not found."
                );

                return;

            }


            const winnerPlayers =
                winnerTeam === "A"
                    ? (
                        match.type === "Single Wicket"
                            ? [match.player_a]
                            : match.team_a_players || []
                    )
                    : (
                        match.type === "Single Wicket"
                            ? [match.player_b]
                            : match.team_b_players || []
                    );


            for (
                const playerName
                of winnerPlayers
            ) {

                const stat =
                    await ensurePlayerStats(
                        playerName
                    );


                if (stat) {

                    await supabaseClient
                        .from("stats")
                        .update({

                            wins:
                                Number(
                                    stat.wins || 0
                                ) + 1

                        })
                        .eq(
                            "player",
                            playerName
                        );

                }

            }


            const {
                error: resultError
            } =
                await supabaseClient
                    .from("results")
                    .insert({

                        match_id:
                            Number(matchId),

                        winner_team:
                            winnerTeam,

                        winner:
                            getTeamDisplay(
                                match,
                                winnerTeam
                            ),

                        loser:
                            getTeamDisplay(
                                match,
                                winnerTeam === "A"
                                    ? "B"
                                    : "A"
                            ),

                        score:
                            score,

                        player_of_match:
                            playerOfMatch

                    });


            if (resultError) {

                alert(
                    "Could not save result: " +
                    resultError.message
                );

                return;

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
                        Number(matchId)
                    );


            if (matchError) {

                alert(
                    "Result saved, but match status could not update: " +
                    matchError.message
                );

                return;

            }


            resultForm.reset();

            await loadDatabase();

            alert(
                "Result successfully saved!"
            );

        }
    );

}


// ========================================
// RESULTS DISPLAY
// ========================================

function renderResults() {

    const container =
        document.getElementById(
            "resultsContainer"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        savedResults.length === 0
    ) {

        container.innerHTML = `

            <div class="result-card">

                <div>

                    <h3>
                        No results yet
                    </h3>

                    <p>
                        Results will appear here after
                        matches are completed.
                    </p>

                </div>

            </div>

        `;

        return;

    }


    savedResults.forEach(
        result => {

            const match =
                savedMatches.find(
                    item =>
                        item.id ==
                        result.match_id
                );


            if (!match) {
                return;
            }


            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "result-card";


            const isSingle =
                match.type ===
                "Single Wicket";


            card.innerHTML = `

                <div>

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

                    <h3>

                        ${escapeHTML(
                            getTeamDisplay(
                                match,
                                "A"
                            )
                        )}

                        <span>VS</span>

                        ${escapeHTML(
                            getTeamDisplay(
                                match,
                                "B"
                            )
                        )}

                    </h3>

                    <p>
                        Winner:
                        <strong>
                            ${escapeHTML(
                                result.winner
                            )}
                        </strong>
                    </p>

                    <p>
                        📊 Score:
                        ${escapeHTML(
                            result.score
                        )}
                    </p>

                    <p>
                        ⭐ Player of the Match:
                        <strong>
                            ${escapeHTML(
                                result.player_of_match
                            )}
                        </strong>
                    </p>

                </div>

                <div class="winner">
                    🏆 WINNER
                </div>

            `;


            container.appendChild(
                card
            );

        }
    );

}


// ========================================
// STATS FORM
// ========================================

const statsForm =
    document.getElementById(
        "statsForm"
    );


if (statsForm) {

    statsForm.addEventListener(
        "submit",
        async function (event) {

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
                ).value;


            const runs =
                Number(
                    document.getElementById(
                        "runs"
                    ).value
                );


            const wickets =
                Number(
                    document.getElementById(
                        "wickets"
                    ).value
                );


            const wins =
                Number(
                    document.getElementById(
                        "wins"
                    ).value
                );


            if (!player) {

                alert(
                    "Please select a player."
                );

                return;

            }


            const {
                error
            } =
                await supabaseClient
                    .from("stats")
                    .upsert(
                        {

                            player:
                                player,

                            runs:
                                runs,

                            wickets:
                                wickets,

                            wins:
                                wins

                        },
                        {
                            onConflict:
                                "player"
                        }
                    );


            if (error) {

                alert(
                    "Could not save statistics: " +
                    error.message
                );

                return;

            }


            statsForm.reset();

            await loadDatabase();


            alert(
                "Player statistics saved successfully!"
            );

        }
    );

}


// ========================================
// TOP STATISTICS
// ========================================

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


    if (
        savedStats.length === 0
    ) {

        if (topScorer)
            topScorer.textContent =
                "—";

        if (topScorerRuns)
            topScorerRuns.textContent =
                "Runs: 0";

        if (bestBowler)
            bestBowler.textContent =
                "—";

        if (bestBowlerWickets)
            bestBowlerWickets.textContent =
                "Wickets: 0";

        if (mostWins)
            mostWins.textContent =
                "—";

        if (mostWinsCount)
            mostWinsCount.textContent =
                "Wins: 0";

        return;

    }


    const topScorerPlayer =
        [...savedStats].sort(
            (a, b) =>
                Number(b.runs || 0) -
                Number(a.runs || 0)
        )[0];


    const bestBowlerPlayer =
        [...savedStats].sort(
            (a, b) =>
                Number(b.wickets || 0) -
                Number(a.wickets || 0)
        )[0];


    const mostWinsPlayer =
        [...savedStats].sort(
            (a, b) =>
                Number(b.wins || 0) -
                Number(a.wins || 0)
        )[0];


    if (topScorer) {

        topScorer.textContent =
            topScorerPlayer.player;

    }


    if (topScorerRuns) {

        topScorerRuns.textContent =
            "Runs: " +
            Number(
                topScorerPlayer.runs || 0
            );

    }


    if (bestBowler) {

        bestBowler.textContent =
            bestBowlerPlayer.player;

    }


    if (bestBowlerWickets) {

        bestBowlerWickets.textContent =
            "Wickets: " +
            Number(
                bestBowlerPlayer.wickets || 0
            );

    }


    if (mostWins) {

        mostWins.textContent =
            mostWinsPlayer.player;

    }


    if (mostWinsCount) {

        mostWinsCount.textContent =
            "Wins: " +
            Number(
                mostWinsPlayer.wins || 0
            );

    }

}


// ========================================
// PLAYER OF MATCH COUNT
// ========================================

function getPlayerOfMatchCount(
    playerName
) {

    return savedResults.filter(
        result =>
            result.player_of_match ===
            playerName
    ).length;

}


// ========================================
// PLAYERS
// ========================================

function renderPlayers() {

    const container =
        document.getElementById(
            "playersContainer"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    getAllPlayers().forEach(
        function (playerName, index) {

            const playerStats =
                savedStats.find(
                    stat =>
                        stat.player ===
                        playerName
                );


            const runs =
                playerStats
                    ? Number(
                        playerStats.runs || 0
                    )
                    : 0;


            const wickets =
                playerStats
                    ? Number(
                        playerStats.wickets || 0
                    )
                    : 0;


            const wins =
                playerStats
                    ? Number(
                        playerStats.wins || 0
                    )
                    : 0;


            const matchesPlayed =
                savedMatches.filter(
                    match => {

                        if (
                            match.status !==
                            "Completed"
                        ) {

                            return false;

                        }


                        return getPlayerNames(
                            match
                        ).includes(
                            playerName
                        );

                    }
                ).length;


            const pom =
                getPlayerOfMatchCount(
                    playerName
                );


            const playerCard =
                document.createElement(
                    "div"
                );


            playerCard.className =
                "player-card";


            playerCard.innerHTML = `

                <div class="player-avatar">
                    🏏
                </div>

                <span>
                    ${String(
                        index + 1
                    ).padStart(2, "0")}
                </span>

                <h3>
                    ${escapeHTML(
                        playerName
                    )}
                </h3>

                <p>
                    Cross Cricket Player
                </p>

                <div class="player-stats">

                    <div>
                        <strong>${runs}</strong>
                        <span>Runs</span>
                    </div>

                    <div>
                        <strong>${wickets}</strong>
                        <span>Wickets</span>
                    </div>

                    <div>
                        <strong>${wins}</strong>
                        <span>Wins</span>
                    </div>

                    <div>
                        <strong>${matchesPlayed}</strong>
                        <span>Matches</span>
                    </div>

                </div>

                <div class="pom-badge">
                    ⭐ Player of Match: ${pom}
                </div>

            `;


            container.appendChild(
                playerCard
            );

        }
    );

}


// ========================================
// FULL SCHEDULE
// ========================================

function renderFullSchedule() {

    const container =
        document.getElementById(
            "fullScheduleContainer"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    if (
        savedMatches.length === 0
    ) {

        container.innerHTML = `

            <tr>

                <td
                    colspan="6"
                    class="no-matches"
                >
                    No matches scheduled yet.
                </td>

            </tr>

        `;

        return;

    }


    const sortedMatches =
        [...savedMatches].sort(
            (a, b) => {

                const dateA =
                    new Date(
                        a.date +
                        "T" +
                        a.time
                    );

                const dateB =
                    new Date(
                        b.date +
                        "T" +
                        b.time
                    );

                return dateA - dateB;

            }
        );


    sortedMatches.forEach(
        match => {

            const row =
                document.createElement(
                    "tr"
                );


            const isSingle =
                match.type ===
                "Single Wicket";


            row.innerHTML = `

                <td>
                    ${escapeHTML(match.date)}
                </td>

                <td>
                    ${escapeHTML(match.time)}
                </td>

                <td>

                    <strong>
                        ${escapeHTML(
                            getTeamDisplay(
                                match,
                                "A"
                            )
                        )}
                    </strong>

                    <span class="vs-text">
                        VS
                    </span>

                    <strong>
                        ${escapeHTML(
                            getTeamDisplay(
                                match,
                                "B"
                            )
                        )}
                    </strong>

                </td>

                <td>
                    ${
                        isSingle
                            ? "Single Wicket • 1v1"
                            : "Double Wicket • 2v2"
                    }
                </td>

                <td>
                    ${escapeHTML(match.venue)}
                </td>

                <td>

                    <span class="schedule-status ${
                        match.status ===
                        "Completed"
                            ? "completed"
                            : "upcoming"
                    }">

                        ${escapeHTML(
                            match.status
                        )}

                    </span>

                </td>

            `;


            container.appendChild(
                row
            );

        }
    );

}


// ========================================
// START
// ========================================

async function startWebsite() {

    console.log(
        "Cross Cricket website starting..."
    );

    await checkAdmin();

    await loadDatabase();

}


// ========================================
// AUTO REFRESH
// ========================================

setInterval(
    function () {

        loadDatabase();

    },
    60000
);


// ========================================
// START
// ========================================

startWebsite();