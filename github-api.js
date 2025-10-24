/**
 * GitHub Gist API連携クラス
 * ゴルフコンペのデータをGitHub Gistに保存・読み込みする
 */
class GitHubGistAPI {
    constructor() {
        this.token = null;
        this.gistId = null;
        this.baseUrl = 'https://api.github.com';
    }

    /**
     * GitHub Personal Access Tokenを設定
     * @param {string} token - GitHub Personal Access Token
     */
    setToken(token) {
        this.token = token;
    }

    /**
     * APIリクエストを送信
     * @param {string} url - APIエンドポイント
     * @param {Object} options - リクエストオプション
     * @returns {Promise} - APIレスポンス
     */
    async makeRequest(url, options = {}) {
        if (!this.token) {
            throw new Error('GitHub token is not set');
        }

        const defaultOptions = {
            headers: {
                'Authorization': `token ${this.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(`GitHub API Error: ${error.message || response.statusText}`);
        }

        return response.json();
    }

    /**
     * ゴルフコンペ用のGistを作成または取得
     * @returns {Promise<string>} - Gist ID
     */
    async getOrCreateGist() {
        if (this.gistId) {
            return this.gistId;
        }

        try {
            // 既存のGistを検索
            const gists = await this.makeRequest(`${this.baseUrl}/gists`);
            const golfGist = gists.find(gist => 
                gist.description === 'Golf Competition Manager Data' &&
                gist.public === false
            );

            if (golfGist) {
                this.gistId = golfGist.id;
                return this.gistId;
            }

            // 新しいGistを作成
            const gistData = {
                description: 'Golf Competition Manager Data',
                public: false,
                files: {
                    'golf-data.json': {
                        content: JSON.stringify({
                            participants: [],
                            competitions: [],
                            attendance: [],
                            settings: {
                                version: '1.0',
                                createdAt: new Date().toISOString()
                            }
                        }, null, 2)
                    }
                }
            };

            const newGist = await this.makeRequest(`${this.baseUrl}/gists`, {
                method: 'POST',
                body: JSON.stringify(gistData)
            });

            this.gistId = newGist.id;
            return this.gistId;
        } catch (error) {
            console.error('Error creating/getting Gist:', error);
            throw error;
        }
    }

    /**
     * データをGistから読み込み
     * @returns {Promise<Object>} - ゴルフコンペデータ
     */
    async loadData() {
        try {
            await this.getOrCreateGist();
            const gist = await this.makeRequest(`${this.baseUrl}/gists/${this.gistId}`);
            
            if (!gist.files['golf-data.json']) {
                throw new Error('Golf data file not found in Gist');
            }

            const content = gist.files['golf-data.json'].content;
            return JSON.parse(content);
        } catch (error) {
            console.error('Error loading data:', error);
            throw error;
        }
    }

    /**
     * データをGistに保存
     * @param {Object} data - 保存するデータ
     * @returns {Promise<void>}
     */
    async saveData(data) {
        try {
            await this.getOrCreateGist();
            
            const gistData = {
                files: {
                    'golf-data.json': {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            };

            await this.makeRequest(`${this.baseUrl}/gists/${this.gistId}`, {
                method: 'PATCH',
                body: JSON.stringify(gistData)
            });
        } catch (error) {
            console.error('Error saving data:', error);
            throw error;
        }
    }

    /**
     * 参加者データを保存
     * @param {Array} participants - 参加者配列
     * @returns {Promise<void>}
     */
    async saveParticipants(participants) {
        const data = await this.loadData();
        data.participants = participants;
        await this.saveData(data);
    }

    /**
     * コンペデータを保存
     * @param {Array} competitions - コンペ配列
     * @returns {Promise<void>}
     */
    async saveCompetitions(competitions) {
        const data = await this.loadData();
        data.competitions = competitions;
        await this.saveData(data);
    }

    /**
     * 出欠データを保存
     * @param {Array} attendance - 出欠配列
     * @returns {Promise<void>}
     */
    async saveAttendance(attendance) {
        const data = await this.loadData();
        data.attendance = attendance;
        await this.saveData(data);
    }

    /**
     * 全データを保存
     * @param {Object} allData - 全データオブジェクト
     * @returns {Promise<void>}
     */
    async saveAllData(allData) {
        await this.saveData(allData);
    }

    /**
     * トークンの有効性を確認
     * @returns {Promise<boolean>} - トークンが有効かどうか
     */
    async validateToken() {
        try {
            await this.makeRequest(`${this.baseUrl}/user`);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * GistのURLを取得
     * @returns {string} - GistのURL
     */
    getGistUrl() {
        if (this.gistId) {
            return `https://gist.github.com/${this.gistId}`;
        }
        return null;
    }
}

// グローバルにGitHubGistAPIクラスを公開
window.GitHubGistAPI = GitHubGistAPI;


