window.Clicker = window.Clicker || {};

const DB = {
    config: {
        store: null,
        db: null,
    },

    init() {
        const request = indexedDB.open("DB");

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore("users", {keyPath: "email"});
            }
        };

        request.onsuccess = () => {
            DB.config.db = request.result;
        };

        request.onerror = () => {
            console.warn('Error while creating the database');
        };
    },

    addUser(user, form) {
        const transaction = DB.config.db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        const newUser = {
            ...user,
            score: 0,
            level: 1,
            time: new Date().getTime()
        }

        const req = store.add(newUser);

        req.onsuccess = () => {
            Clicker.storeUser(newUser);
            Clicker.startGame(newUser);
            Clicker.clearForm(form);
        };

        req.onerror = () => {
            if (req.error.code === 0) {
                Clicker.showError('User with such E-mail already exist');
            } else {
                console.warn('Error while adding user');
            }
        };
    },

    checkUser(user, form) {
        const transaction = DB.config.db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const req = store.get(user.email);

        req.onerror = () => {
            Clicker.showError(req.error.message);
        };

        req.onsuccess = () => {
            if (!req.result) {
                Clicker.showError('User with such E-mail doesn\'t exist');
            } else {
                if (req.result.password === user.password) {
                    Clicker.storeUser(req.result);
                    Clicker.startGame(req.result);
                    Clicker.clearForm(form);
                } else {
                    Clicker.showError('Wrong password');
                }
            }
        };
    },

    updateUser(user, reset = false) {
        const transaction = DB.config.db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        const req = store.get(user.email);

        req.onerror = () => {
            Clicker.showError(req.error.message);
        };

        req.onsuccess = () => {
            const data = req.result;
            data.score = !reset ? user.score : 0;
            data.level = !reset ? user.level : 1;
            data.time = !reset ? user.time : new Date().getTime();

            const reqUpdate = store.put(data);

            reqUpdate.onsuccess = () => {
                console.log('User was updated');
            };

            reqUpdate.onerror = () => {
                console.warn('Error while updating user');
            };
        };
    }
};

(function () {
    Clicker = {
        config: {
            levels: 5,
            enemyBaseHealth: 5,
            header: document.getElementById('header'),
            signIn: document.getElementById('signIn'),
            signUp: document.getElementById('signUp'),
            logout: document.getElementById('logout'),
            registrationContainer: document.getElementById('registrationContainer'),
            registrationForm: document.getElementById('registrationForm'),
            loginContainer: document.getElementById('loginContainer'),
            loginForm: document.getElementById('loginForm'),
            error: document.getElementById('error'),
            mainContainer: document.getElementById('main'),
            mainContainerClasses: ['container--level_1', 'container--level_2', 'container--level_3', 'container--level_4', 'container--level_5'],
            attack: document.getElementById('attack'),
            modalAction: document.getElementById('modalAction'),
            game: document.getElementById('game'),
            playerInfo: document.getElementById('playerInfo'),
            playerName: document.getElementById('playerName'),
            playerScore: document.getElementById('playerScore'),
            playerLevel: document.getElementById('playerLevel'),
            monsterHealth: document.getElementById('monsterHealth'),
            modal: document.getElementById('modal'),
            modalDescription: document.getElementById('modalDescription'),
            hitSound: new Audio('../audio/hit.mp3'),

            user: {
                fullname: null,
                score: null,
                level: null,
                email: null,
                time: null
            }
        },

        init() {
            this.events();
            DB.init();
        },

        events() {
            this.config.signIn.addEventListener('click', this.showLogin.bind(this));
            this.config.signUp.addEventListener('click', this.showRegister.bind(this));
            this.config.logout.addEventListener('click', this.logout.bind(this));
            this.config.registrationForm.addEventListener('submit', this.register.bind(this));
            this.config.loginForm.addEventListener('submit', this.login.bind(this));
            this.config.attack.addEventListener('click', this.attack.bind(this));
            this.config.modalAction.addEventListener('click', this.goToNextLevel.bind(this));
        },

        showLogin() {
            this.config.loginContainer.classList.remove('hidden');
            this.config.registrationContainer.classList.add('hidden');
            this.hideError();
        },

        showRegister() {
            this.config.registrationContainer.classList.remove('hidden');
            this.config.loginContainer.classList.add('hidden');
            this.hideError();
        },

        register(e) {
            e.preventDefault();
            this.hideError();

            const form = e.target;
            const user = Object.fromEntries(new FormData(form));
            const isFormValid = this.validateForm(user);

            if (!isFormValid) {
                this.showError('Please fill in all fields correctly');
                return;
            }

            DB.addUser(user, form);
        },

        validateForm(user) {
            const emailRegExp = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

            for (let [key, value] of Object.entries(user)) {
                if (value.trim() === '') {
                    return false;
                }

                if (key === 'email' && !emailRegExp.test(value)) {
                    return false;
                }
            }

            return true;
        },

        showError(message) {
            this.config.error.textContent = message;
            this.config.error.classList.remove('hidden');
        },

        hideError() {
            this.config.error.textContent = '';
            this.config.error.classList.add('hidden');
        },

        clearForm(form) {
            form.reset();
        },

        storeUser({ fullname, score, level, email, time }) {
            this.config.user.fullname = fullname;
            this.config.user.score = score;
            this.config.user.level = level;
            this.config.user.email = email;
            this.config.user.time = time;
        },

        removeUser() {
            this.config.user.fullname = null;
            this.config.user.score = null;
            this.config.user.level = null;
            this.config.user.email = null;
            this.config.user.time = null;
        },

        startGame({ fullname = this.config.user.fullname, score = this.config.user.score, level = this.config.user.level }) {
            this.config.registrationContainer.classList.add('hidden');
            this.config.loginContainer.classList.add('hidden');
            this.config.signIn.classList.add('hidden');
            this.config.signUp.classList.add('hidden');
            this.config.logout.classList.remove('hidden');
            this.config.game.classList.remove('hidden');
            this.config.playerInfo.classList.remove('hidden');

            this.config.header.classList.add('header--game');

            if (level <= this.config.levels) {
                this.startLevel(fullname, score, level);
            } else {
                this.resetGame();
            }
        },

        resetGame() {
            this.config.user.score = 0;
            this.config.user.level = 1;
            this.config.user.time = new Date().getTime();
            DB.updateUser(this.config.user, true);
            this.startGame(this.config.user);
        },

        saveGame() {
            DB.updateUser(this.config.user);
        },

        startLevel(fullname, score, level) {
            this.showPlayerInfo(fullname, score, level, level * this.config.enemyBaseHealth);

            this.config.mainContainer.classList.remove(...this.config.mainContainerClasses);
            this.config.mainContainer.classList.add(this.config.mainContainerClasses[level - 1]);
        },

        levelCompleted(message) {
            this.showModal(message);
            this.saveGame();
        },

        attack() {
            this.config.hitSound.play();
            this.config.monsterHealth.textContent--;
            this.config.user.score = ++this.config.playerScore.textContent;

            if (+this.config.monsterHealth.textContent === 0) {
                const levelUp = +this.config.playerLevel.textContent + 1;
                let message = `You complete level <span class="modal__result">${this.config.playerLevel.textContent}!</span><br>
                                Your score is <span class="modal__result">${this.config.playerScore.textContent}!</span><br>
                                Go to the next level?`;
                this.config.user.level = levelUp;

                if (levelUp > 5) {
                    const resultTime = this.msToTime(new Date().getTime() - this.config.user.time);

                    message = `<span class="modal__result">YOU WIN!</span><br>
                                Your score is <span class="modal__result">${this.config.playerScore.textContent}!</span><br>
                                Your time is <span class="modal__result">${resultTime}!</span><br>
                                Do you want to play again?`;
                }

                this.levelCompleted(message);
            }
        },

        showModal(message) {
            this.config.modal.classList.remove('hidden');
            this.config.modalDescription.innerHTML = message;
        },

        hideModal() {
            this.config.modal.classList.add('hidden');
            this.config.modalDescription.innerHTML = '';
        },

        goToNextLevel() {
            this.startGame({score: this.config.user.score, level: this.config.user.level });
            this.hideModal();
        },

        showPlayerInfo(fullname, score, level, monsterHealth) {
            this.config.playerName.textContent = fullname;
            this.config.playerScore.textContent = score;
            this.config.playerLevel.textContent = level;
            this.config.monsterHealth.textContent = monsterHealth;
        },

        login(e) {
            e.preventDefault();
            this.hideError();

            const form = e.target;
            const user = Object.fromEntries(new FormData(form));
            this.config.user.time = new Date().getTime();

            DB.checkUser(user, form);
        },

        logout() {
            this.config.signIn.classList.remove('hidden');
            this.config.signUp.classList.remove('hidden');
            this.config.logout.classList.add('hidden');
            this.config.playerInfo.classList.add('hidden');
            this.config.game.classList.add('hidden');
            this.config.mainContainer.classList.remove(...this.config.mainContainerClasses);

            this.config.header.classList.remove('header--game');

            this.removeUser();
        },

        msToTime(ms) {
            const hours = Math.floor(ms / 3600000);
            const minutes = Math.floor((ms % 3600000) / 60000);
            const seconds = Math.floor(((ms % 360000) % 60000) / 1000);

            return `${hours}h ${minutes}m ${seconds}s`;
        }
    }

    document.addEventListener('DOMContentLoaded', Clicker.init.bind(window.Clicker));
})();