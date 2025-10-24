/**
 * ゴルフコンペ管理システム
 * メインアプリケーションロジック
 */
class GolfCompetitionManager {
    constructor() {
        this.githubAPI = new GitHubGistAPI();
        this.currentData = {
            participants: [],
            competitions: [],
            attendance: []
        };
        this.sitePassword = 'golf2025'; // デフォルトパスワード
        this.isAuthenticated = false;
        
        this.init();
    }

    /**
     * アプリケーション初期化
     */
    async init() {
        this.loadSettings();
        this.bindEvents();
        this.showLoginScreen();
    }

    /**
     * 設定を読み込み
     */
    loadSettings() {
        const settings = localStorage.getItem('golfSettings');
        if (settings) {
            const parsed = JSON.parse(settings);
            this.sitePassword = parsed.sitePassword || 'golf2025';
            if (parsed.githubToken) {
                this.githubAPI.setToken(parsed.githubToken);
            }
        }
    }

    /**
     * 設定を保存
     */
    saveSettings() {
        const settings = {
            sitePassword: this.sitePassword,
            githubToken: this.githubAPI.token
        };
        localStorage.setItem('golfSettings', JSON.stringify(settings));
    }

    /**
     * イベントリスナーを設定
     */
    bindEvents() {
        // ログイン関連
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // ログアウト
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());

        // 設定関連
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettingsFromForm());
        document.getElementById('backToMainBtn').addEventListener('click', () => this.showMainApp());

        // ナビゲーション
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // 参加者管理
        document.getElementById('addParticipantBtn').addEventListener('click', () => this.showAddParticipantModal());

        // コンペ管理
        document.getElementById('addCompetitionBtn').addEventListener('click', () => this.showAddCompetitionModal());

        // 出欠管理
        document.getElementById('competitionSelect').addEventListener('change', (e) => this.loadAttendanceForCompetition(e.target.value));

        // レポート
        document.getElementById('participantReportSelect').addEventListener('change', (e) => this.showParticipantReport(e.target.value));
        document.getElementById('competitionReportSelect').addEventListener('change', (e) => this.showCompetitionReport(e.target.value));

        // エクスポート
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());

        // モーダル
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        document.getElementById('modal').addEventListener('click', (e) => {
            if (e.target.id === 'modal') this.closeModal();
        });
    }

    /**
     * ログイン処理
     */
    handleLogin() {
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');
        
        if (password === this.sitePassword) {
            this.isAuthenticated = true;
            this.showMainApp();
            this.loadData();
        } else {
            errorDiv.textContent = 'パスワードが正しくありません';
            errorDiv.style.display = 'block';
        }
    }

    /**
     * ログアウト処理
     */
    logout() {
        this.isAuthenticated = false;
        this.showLoginScreen();
        document.getElementById('loginPassword').value = '';
    }

    /**
     * ログイン画面を表示
     */
    showLoginScreen() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('settingsScreen').classList.add('hidden');
    }

    /**
     * メインアプリケーションを表示
     */
    showMainApp() {
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('mainApp').classList.remove('hidden');
        document.getElementById('settingsScreen').classList.add('hidden');
    }

    /**
     * 設定画面を表示
     */
    showSettings() {
        document.getElementById('mainApp').classList.add('hidden');
        document.getElementById('settingsScreen').classList.remove('hidden');
        
        // 現在の設定をフォームに反映
        document.getElementById('githubToken').value = this.githubAPI.token || '';
        document.getElementById('sitePassword').value = this.sitePassword;
    }

    /**
     * 設定フォームから保存
     */
    saveSettingsFromForm() {
        const token = document.getElementById('githubToken').value.trim();
        const password = document.getElementById('sitePassword').value.trim();
        
        if (token) {
            this.githubAPI.setToken(token);
        }
        
        if (password) {
            this.sitePassword = password;
        }
        
        this.saveSettings();
        this.showMainApp();
        this.loadData();
    }

    /**
     * タブ切り替え
     */
    switchTab(tabName) {
        console.log('Switching to tab:', tabName);
        
        // ナビゲーションボタンの状態更新
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // タブコンテンツの表示切り替え
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');

        // タブごとの初期化処理（少し遅延させて確実に実行）
        setTimeout(() => {
            switch (tabName) {
                case 'participants':
                    this.renderParticipantsTable();
                    break;
                case 'competitions':
                    console.log('Rendering competitions table...');
                    this.renderCompetitionsTable();
                    break;
                case 'attendance':
                    console.log('Updating attendance tab...');
                    this.updateCompetitionSelect();
                    break;
                case 'reports':
                    this.updateReportSelects();
                    break;
            }
        }, 100);
    }

    /**
     * データを読み込み
     */
    async loadData() {
        if (!this.githubAPI.token) {
            console.log('GitHub token not set, using local data');
            this.loadLocalData();
            this.renderCurrentTab();
            return;
        }

        try {
            this.showLoading(true);
            const data = await this.githubAPI.loadData();
            console.log('Loaded data from GitHub:', data);
            this.currentData = {
                participants: data.participants || [],
                competitions: data.competitions || [],
                attendance: data.attendance || []
            };
            console.log('Current data after loading:', this.currentData);
            this.saveLocalData();
            this.updateAllSelects();
            // 少し遅延させてからタブを描画
            setTimeout(() => {
                this.renderCurrentTab();
            }, 200);
        } catch (error) {
            console.error('Error loading data:', error);
            this.loadLocalData();
            this.renderCurrentTab();
            alert('データの読み込みに失敗しました。ローカルデータを使用します。');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * ローカルデータを読み込み
     */
    loadLocalData() {
        const localData = localStorage.getItem('golfData');
        console.log('Loading local data:', localData);
        if (localData) {
            this.currentData = JSON.parse(localData);
            console.log('Parsed local data:', this.currentData);
        } else {
            console.log('No local data found, using empty data');
            this.currentData = {
                participants: [],
                competitions: [],
                attendance: []
            };
        }
        this.updateAllSelects();
    }

    /**
     * ローカルデータを保存
     */
    saveLocalData() {
        localStorage.setItem('golfData', JSON.stringify(this.currentData));
    }

    /**
     * データを保存
     */
    async saveData() {
        console.log('Saving data:', this.currentData);
        this.saveLocalData();
        
        if (this.githubAPI.token) {
            try {
                await this.githubAPI.saveAllData(this.currentData);
                console.log('Data saved to GitHub successfully');
                // 保存後に選択肢を更新
                this.updateAllSelects();
            } catch (error) {
                console.error('Error saving data to GitHub:', error);
                alert('GitHubへの保存に失敗しました。ローカルには保存されています。');
            }
        } else {
            console.log('No GitHub token, data saved locally only');
            // ローカル保存後にも選択肢を更新
            this.updateAllSelects();
        }
    }

    /**
     * ローディング表示
     */
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    /**
     * 現在のタブを再描画
     */
    renderCurrentTab() {
        const activeTab = document.querySelector('.nav-btn.active');
        console.log('Rendering current tab:', activeTab ? activeTab.dataset.tab : 'none');
        if (activeTab) {
            this.switchTab(activeTab.dataset.tab);
        }
    }

    /**
     * 参加者テーブルを描画
     */
    renderParticipantsTable() {
        const tbody = document.querySelector('#participantsTable tbody');
        tbody.innerHTML = '';

        this.currentData.participants.forEach(participant => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${participant.name}</td>
                <td>${participant.email}</td>
                <td>${new Date(participant.createdAt).toLocaleDateString('ja-JP')}</td>
                <td>
                    <button class="btn btn-secondary" onclick="golfApp.editParticipant('${participant.id}')">編集</button>
                    <button class="btn btn-danger" onclick="golfApp.deleteParticipant('${participant.id}')">削除</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * コンペテーブルを描画
     */
    renderCompetitionsTable() {
        const tbody = document.querySelector('#competitionsTable tbody');
        if (!tbody) {
            console.error('Competitions table tbody not found!');
            return;
        }
        
        tbody.innerHTML = '';

        console.log('Rendering competitions table. Competitions count:', this.currentData.competitions.length);
        console.log('Competitions data:', this.currentData.competitions);

        if (this.currentData.competitions.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td colspan="5" style="text-align: center; color: #6c757d; padding: 2rem;">
                    コンペが登録されていません。<br>
                    「コンペ追加」ボタンから新しいコンペを追加してください。
                </td>
            `;
            tbody.appendChild(row);
            return;
        }

        this.currentData.competitions.forEach((competition, index) => {
            console.log(`Rendering competition ${index + 1}:`, competition);
            const attendance = this.currentData.attendance.filter(a => a.competitionId === competition.id);
            const participants = attendance.filter(a => a.status === 'present').length;
            const totalFee = attendance.filter(a => a.status === 'present').reduce((sum, a) => sum + (a.fee || 0), 0);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${competition.title}</td>
                <td>${new Date(competition.date).toLocaleDateString('ja-JP')}</td>
                <td>${participants}人</td>
                <td>¥${totalFee.toLocaleString()}</td>
                <td>
                    <button class="btn btn-secondary" onclick="golfApp.editCompetition('${competition.id}')">編集</button>
                    <button class="btn btn-danger" onclick="golfApp.deleteCompetition('${competition.id}')">削除</button>
                </td>
            `;
            tbody.appendChild(row);
            console.log(`Added competition row ${index + 1}`);
        });
        
        console.log('Competitions table rendering completed');
    }

    /**
     * 参加者追加モーダルを表示
     */
    showAddParticipantModal() {
        this.showModal('参加者追加', `
            <form id="participantForm">
                <div class="form-group">
                    <label for="participantName">名前:</label>
                    <input type="text" id="participantName" required>
                </div>
                <div class="form-group">
                    <label for="participantEmail">メールアドレス:</label>
                    <input type="email" id="participantEmail" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">追加</button>
                    <button type="button" class="btn btn-secondary" onclick="golfApp.closeModal()">キャンセル</button>
                </div>
            </form>
        `);

        document.getElementById('participantForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addParticipant();
        });
    }

    /**
     * 参加者を追加
     */
    addParticipant() {
        const name = document.getElementById('participantName').value.trim();
        const email = document.getElementById('participantEmail').value.trim();

        if (!name || !email) {
            alert('名前とメールアドレスを入力してください');
            return;
        }

        const participant = {
            id: this.generateId(),
            name: name,
            email: email,
            createdAt: new Date().toISOString()
        };

        this.currentData.participants.push(participant);
        this.saveData();
        this.renderParticipantsTable();
        this.closeModal();
    }

    /**
     * 参加者を編集
     */
    editParticipant(id) {
        const participant = this.currentData.participants.find(p => p.id === id);
        if (!participant) return;

        this.showModal('参加者編集', `
            <form id="editParticipantForm">
                <div class="form-group">
                    <label for="editParticipantName">名前:</label>
                    <input type="text" id="editParticipantName" value="${participant.name}" required>
                </div>
                <div class="form-group">
                    <label for="editParticipantEmail">メールアドレス:</label>
                    <input type="email" id="editParticipantEmail" value="${participant.email}" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">更新</button>
                    <button type="button" class="btn btn-secondary" onclick="golfApp.closeModal()">キャンセル</button>
                </div>
            </form>
        `);

        document.getElementById('editParticipantForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateParticipant(id);
        });
    }

    /**
     * 参加者を更新
     */
    updateParticipant(id) {
        const name = document.getElementById('editParticipantName').value.trim();
        const email = document.getElementById('editParticipantEmail').value.trim();

        if (!name || !email) {
            alert('名前とメールアドレスを入力してください');
            return;
        }

        const participant = this.currentData.participants.find(p => p.id === id);
        if (participant) {
            participant.name = name;
            participant.email = email;
            this.saveData();
            this.renderParticipantsTable();
            this.closeModal();
        }
    }

    /**
     * 参加者を削除
     */
    deleteParticipant(id) {
        if (confirm('この参加者を削除しますか？')) {
            this.currentData.participants = this.currentData.participants.filter(p => p.id !== id);
            // 関連する出欠データも削除
            this.currentData.attendance = this.currentData.attendance.filter(a => a.participantId !== id);
            this.saveData();
            this.renderParticipantsTable();
        }
    }

    /**
     * コンペ追加モーダルを表示
     */
    showAddCompetitionModal() {
        this.showModal('コンペ追加', `
            <form id="competitionForm">
                <div class="form-group">
                    <label for="competitionTitle">タイトル:</label>
                    <input type="text" id="competitionTitle" placeholder="例: 第1回ゴルフコンペ" required>
                </div>
                <div class="form-group">
                    <label for="competitionDate">日付:</label>
                    <input type="date" id="competitionDate" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">追加</button>
                    <button type="button" class="btn btn-secondary" onclick="golfApp.closeModal()">キャンセル</button>
                </div>
            </form>
        `);

        document.getElementById('competitionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCompetition();
        });
    }

    /**
     * コンペを追加
     */
    async addCompetition() {
        const title = document.getElementById('competitionTitle').value.trim();
        const date = document.getElementById('competitionDate').value;

        if (!title || !date) {
            alert('タイトルと日付を入力してください');
            return;
        }

        const competition = {
            id: this.generateId(),
            title: title,
            date: date,
            createdAt: new Date().toISOString()
        };

        console.log('Adding competition:', competition);
        this.currentData.competitions.push(competition);
        console.log('Competitions after adding:', this.currentData.competitions);
        
        // データを保存してからテーブルを更新
        await this.saveData();
        
        // コンペ管理タブがアクティブな場合のみテーブルを再描画
        const activeTab = document.querySelector('.nav-btn.active');
        if (activeTab && activeTab.dataset.tab === 'competitions') {
            this.renderCompetitionsTable();
        }
        
        this.closeModal();
    }

    /**
     * コンペを編集
     */
    editCompetition(id) {
        const competition = this.currentData.competitions.find(c => c.id === id);
        if (!competition) return;

        this.showModal('コンペ編集', `
            <form id="editCompetitionForm">
                <div class="form-group">
                    <label for="editCompetitionTitle">タイトル:</label>
                    <input type="text" id="editCompetitionTitle" value="${competition.title}" required>
                </div>
                <div class="form-group">
                    <label for="editCompetitionDate">日付:</label>
                    <input type="date" id="editCompetitionDate" value="${competition.date}" required>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">更新</button>
                    <button type="button" class="btn btn-secondary" onclick="golfApp.closeModal()">キャンセル</button>
                </div>
            </form>
        `);

        document.getElementById('editCompetitionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateCompetition(id);
        });
    }

    /**
     * コンペを更新
     */
    updateCompetition(id) {
        const title = document.getElementById('editCompetitionTitle').value.trim();
        const date = document.getElementById('editCompetitionDate').value;

        if (!title || !date) {
            alert('タイトルと日付を入力してください');
            return;
        }

        const competition = this.currentData.competitions.find(c => c.id === id);
        if (competition) {
            competition.title = title;
            competition.date = date;
            this.saveData();
            this.renderCompetitionsTable();
            this.closeModal();
        }
    }

    /**
     * コンペを削除
     */
    deleteCompetition(id) {
        if (confirm('このコンペを削除しますか？関連する出欠データも削除されます。')) {
            this.currentData.competitions = this.currentData.competitions.filter(c => c.id !== id);
            // 関連する出欠データも削除
            this.currentData.attendance = this.currentData.attendance.filter(a => a.competitionId !== id);
            this.saveData();
            this.updateAllSelects();
            this.renderCompetitionsTable();
        }
    }

    /**
     * すべての選択肢を更新
     */
    updateAllSelects() {
        console.log('Updating all selects...');
        this.updateCompetitionSelect();
        this.updateReportSelects();
    }

    /**
     * コンペ選択を更新
     */
    updateCompetitionSelect() {
        const select = document.getElementById('competitionSelect');
        console.log('Updating competition select. Competitions count:', this.currentData.competitions.length);
        console.log('Competitions data:', this.currentData.competitions);
        
        select.innerHTML = '<option value="">コンペを選択してください</option>';
        
        this.currentData.competitions.forEach(competition => {
            const option = document.createElement('option');
            option.value = competition.id;
            option.textContent = `${competition.title} (${new Date(competition.date).toLocaleDateString('ja-JP')})`;
            select.appendChild(option);
            console.log('Added competition option:', option.textContent);
        });
        
        console.log('Competition select updated. Total options:', select.options.length);
    }

    /**
     * 選択されたコンペの出欠を読み込み
     */
    loadAttendanceForCompetition(competitionId) {
        const content = document.getElementById('attendanceContent');
        
        if (!competitionId) {
            content.classList.add('hidden');
            return;
        }

        content.classList.remove('hidden');
        this.renderAttendanceTable(competitionId);
    }

    /**
     * 出欠テーブルを描画
     */
    renderAttendanceTable(competitionId) {
        const tbody = document.querySelector('#attendanceTable tbody');
        tbody.innerHTML = '';

        // 参加者ごとの出欠データを取得
        const attendanceMap = {};
        this.currentData.attendance
            .filter(a => a.competitionId === competitionId)
            .forEach(a => {
                attendanceMap[a.participantId] = a;
            });

        this.currentData.participants.forEach(participant => {
            const attendance = attendanceMap[participant.id] || {
                participantId: participant.id,
                competitionId: competitionId,
                status: 'pending',
                fee: 0
            };

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${participant.name}</td>
                <td>
                    <select onchange="golfApp.updateAttendanceStatus('${participant.id}', '${competitionId}', this.value)">
                        <option value="pending" ${attendance.status === 'pending' ? 'selected' : ''}>未定</option>
                        <option value="present" ${attendance.status === 'present' ? 'selected' : ''}>出席</option>
                        <option value="absent" ${attendance.status === 'absent' ? 'selected' : ''}>欠席</option>
                    </select>
                </td>
                <td>
                    <input type="number" value="${attendance.fee || 0}" 
                           onchange="golfApp.updateAttendanceFee('${participant.id}', '${competitionId}', this.value)"
                           ${attendance.status !== 'present' ? 'disabled' : ''}>
                </td>
                <td>
                    <button class="btn btn-danger" onclick="golfApp.removeAttendance('${participant.id}', '${competitionId}')">削除</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * 出欠ステータスを更新
     */
    updateAttendanceStatus(participantId, competitionId, status) {
        const existingIndex = this.currentData.attendance.findIndex(
            a => a.participantId === participantId && a.competitionId === competitionId
        );

        if (existingIndex >= 0) {
            this.currentData.attendance[existingIndex].status = status;
            if (status !== 'present') {
                this.currentData.attendance[existingIndex].fee = 0;
            }
        } else {
            this.currentData.attendance.push({
                participantId: participantId,
                competitionId: competitionId,
                status: status,
                fee: status === 'present' ? 0 : 0
            });
        }

        this.saveData();
        this.renderAttendanceTable(competitionId);
    }

    /**
     * 参加費を更新
     */
    updateAttendanceFee(participantId, competitionId, fee) {
        const attendance = this.currentData.attendance.find(
            a => a.participantId === participantId && a.competitionId === competitionId
        );

        if (attendance) {
            attendance.fee = parseInt(fee) || 0;
            this.saveData();
        }
    }

    /**
     * 出欠データを削除
     */
    removeAttendance(participantId, competitionId) {
        this.currentData.attendance = this.currentData.attendance.filter(
            a => !(a.participantId === participantId && a.competitionId === competitionId)
        );
        this.saveData();
        this.renderAttendanceTable(competitionId);
    }

    /**
     * レポート選択を更新
     */
    updateReportSelects() {
        // 参加者選択
        const participantSelect = document.getElementById('participantReportSelect');
        participantSelect.innerHTML = '<option value="">参加者を選択してください</option>';
        this.currentData.participants.forEach(participant => {
            const option = document.createElement('option');
            option.value = participant.id;
            option.textContent = participant.name;
            participantSelect.appendChild(option);
        });

        // コンペ選択
        const competitionSelect = document.getElementById('competitionReportSelect');
        competitionSelect.innerHTML = '<option value="">コンペを選択してください</option>';
        this.currentData.competitions.forEach(competition => {
            const option = document.createElement('option');
            option.value = competition.id;
            option.textContent = `${competition.title} (${new Date(competition.date).toLocaleDateString('ja-JP')})`;
            competitionSelect.appendChild(option);
        });
    }

    /**
     * 参加者レポートを表示
     */
    showParticipantReport(participantId) {
        const reportDiv = document.getElementById('participantReport');
        
        if (!participantId) {
            reportDiv.innerHTML = '';
            return;
        }

        const participant = this.currentData.participants.find(p => p.id === participantId);
        if (!participant) return;

        const attendance = this.currentData.attendance.filter(a => a.participantId === participantId);
        const competitions = this.currentData.competitions;
        
        let totalFee = 0;
        let presentCount = 0;

        let html = `
            <h4>${participant.name} の参加履歴</h4>
            <p><strong>メールアドレス:</strong> ${participant.email}</p>
            <hr>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>コンペ</th>
                        <th>日付</th>
                        <th>出欠</th>
                        <th>参加費</th>
                    </tr>
                </thead>
                <tbody>
        `;

        attendance.forEach(a => {
            const competition = competitions.find(c => c.id === a.competitionId);
            if (competition) {
                const statusText = a.status === 'present' ? '出席' : a.status === 'absent' ? '欠席' : '未定';
                const statusClass = a.status === 'present' ? 'status-present' : a.status === 'absent' ? 'status-absent' : 'status-pending';
                
                html += `
                    <tr>
                        <td>${competition.title}</td>
                        <td>${new Date(competition.date).toLocaleDateString('ja-JP')}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>¥${(a.fee || 0).toLocaleString()}</td>
                    </tr>
                `;

                if (a.status === 'present') {
                    totalFee += a.fee || 0;
                    presentCount++;
                }
            }
        });

        html += `
                </tbody>
            </table>
            <hr>
            <p><strong>参加回数:</strong> ${presentCount}回</p>
            <p><strong>累計参加費:</strong> ¥${totalFee.toLocaleString()}</p>
        `;

        reportDiv.innerHTML = html;
    }

    /**
     * コンペレポートを表示
     */
    showCompetitionReport(competitionId) {
        const reportDiv = document.getElementById('competitionReport');
        
        if (!competitionId) {
            reportDiv.innerHTML = '';
            return;
        }

        const competition = this.currentData.competitions.find(c => c.id === competitionId);
        if (!competition) return;

        const attendance = this.currentData.attendance.filter(a => a.competitionId === competitionId);
        const participants = this.currentData.participants;
        
        let totalFee = 0;
        let presentCount = 0;
        let absentCount = 0;
        let pendingCount = 0;

        let html = `
            <h4>${competition.title}</h4>
            <p><strong>日付:</strong> ${new Date(competition.date).toLocaleDateString('ja-JP')}</p>
            <hr>
            <table class="data-table">
                <thead>
                    <tr>
                        <th>参加者</th>
                        <th>出欠</th>
                        <th>参加費</th>
                    </tr>
                </thead>
                <tbody>
        `;

        attendance.forEach(a => {
            const participant = participants.find(p => p.id === a.participantId);
            if (participant) {
                const statusText = a.status === 'present' ? '出席' : a.status === 'absent' ? '欠席' : '未定';
                const statusClass = a.status === 'present' ? 'status-present' : a.status === 'absent' ? 'status-absent' : 'status-pending';
                
                html += `
                    <tr>
                        <td>${participant.name}</td>
                        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                        <td>¥${(a.fee || 0).toLocaleString()}</td>
                    </tr>
                `;

                if (a.status === 'present') {
                    totalFee += a.fee || 0;
                    presentCount++;
                } else if (a.status === 'absent') {
                    absentCount++;
                } else {
                    pendingCount++;
                }
            }
        });

        html += `
                </tbody>
            </table>
            <hr>
            <p><strong>出席者数:</strong> ${presentCount}人</p>
            <p><strong>欠席者数:</strong> ${absentCount}人</p>
            <p><strong>未定者数:</strong> ${pendingCount}人</p>
            <p><strong>合計参加費:</strong> ¥${totalFee.toLocaleString()}</p>
        `;

        reportDiv.innerHTML = html;
    }

    /**
     * データをエクスポート
     */
    exportData() {
        const data = {
            participants: this.currentData.participants,
            competitions: this.currentData.competitions,
            attendance: this.currentData.attendance,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `golf-competition-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * モーダルを表示
     */
    showModal(title, content) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = content;
        document.getElementById('modal').classList.remove('hidden');
    }

    /**
     * モーダルを閉じる
     */
    closeModal() {
        document.getElementById('modal').classList.add('hidden');
    }

    /**
     * ユニークIDを生成
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
}

// アプリケーションを初期化
let golfApp;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Golf Competition Manager...');
    try {
        golfApp = new GolfCompetitionManager();
        console.log('Golf Competition Manager initialized successfully');
    } catch (error) {
        console.error('Error initializing Golf Competition Manager:', error);
        alert('アプリケーションの初期化に失敗しました: ' + error.message);
    }
});

// グローバルエラーハンドラー
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    alert('エラーが発生しました: ' + event.error.message);
});

// ページ読み込み完了時のログ
window.addEventListener('load', () => {
    console.log('Page fully loaded');
});
