import nodegui from '@nodegui/nodegui';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import AbortController from 'abort-controller';

const { 
    QMainWindow,
    QWidget,
    FlexLayout,
    QDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QComboBox,
    ItemFlag,
    CheckState,
    QPushButton,
    QProgressBar,
    QFileDialog,
    QSpinBox,
    FileMode,
    EchoMode
} = nodegui;

const config = {
    CLIENT_ID: 0,
    CLIENT_SECRET: "",
    API_KEY: "",
    BEATMAP_API_BASE: "https://osu.lea.moe"
};

const scores = [];

const columns = [
    "Date","Score ID","User ID","Beatmapset ID","Beatmap ID","Ranked State","AR","CS","OD","HP","BPM","Version","Hit Length",
    "Star Rating","Mods Array","Mods Enum","Rank","Position","Score","Combo","FC","Accuracy","300","100","50","Miss","PP","Replay"
];

const RANKED_STATE = {
    '-2': 'graveyard',
    '-1': 'WIP',
    '0': 'pending',
    '1': 'ranked',
    "2": 'approved',
    '3': 'qualified',
    '4': 'loved'
};

const MODS_ENUM = {
    ''    : 0,
    'NF'  : 1,
    'EZ'  : 2,
    'TD'  : 4,
    'HD'  : 8,
    'HR'  : 16,
    'SD'  : 32,
    'DT'  : 64,
    'RX'  : 128,
    'HT'  : 256,
    'NC'  : 512,
    'FL'  : 1024,
    'AT'  : 2048,
    'SO'  : 4096,
    'AP'  : 8192,
    'PF'  : 16384,
    '4K'  : 32768,
    '5K'  : 65536,
    '6K'  : 131072,
    '7K'  : 262144,
    '8K'  : 524288,
    'FI'  : 1048576,
    'RD'  : 2097152,
    'LM'  : 4194304,
    '9K'  : 16777216,
    '10K' : 33554432,
    '1K'  : 67108864,
    '3K'  : 134217728,
    '2K'  : 268435456,
    'V2'  : 536870912,
};

const modsEnumToArray = number => {
    const output = [];

    for (const mod in MODS_ENUM) {
        const modValue = MODS_ENUM[mod];

        if (number & modValue == modValue) {
            output.push(mod);
        }
    }

    return output;
};

const modsArrayToEnum = array => {
    let output = 0;

    for (const mod of array) {
        if (Object.keys(MODS_ENUM).includes(mod)) {
            output |= MODS_ENUM[mod];
        }
    }

    return output;
};

const accuracy = (count50, count100, count300, countmiss) => {
    count50 = Number(count50);
    count100 = Number(count100);
    count300 = Number(count300);
    countmiss = Number(countmiss);

    const acc = 
    (50 * count50 + 100 * count100 + 300 * count300)
    / (300 * count50 + 300 * count100 + 300 * count300 + 300 * countmiss)
    * 100;

    return acc;
};

let TOKEN;
let cancelFetch = false;

const saveConfig = async () => {
    await fs.writeFile('./config.json', JSON.stringify(config, null, 2));
};

const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const apiRequest = async url => {
    const controller = new AbortController();

    const requestConfig = {
        method: 'get',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
        signal: controller.signal
    };

    let timeout;

    timeout = setTimeout(() => {
        controller.abort();
    }, 5000);

    let response = await fetch(url, requestConfig);

    clearTimeout(timeout);

    let json = await response.json();

    if (json.authentication == 'basic') {
        await getOauthToken();
    } else {
        return json;
    }

    requestConfig.headers['Authorization'] = `Bearer ${TOKEN}`;

    timeout = setTimeout(() => {
        controller.abort();
    }, 5000);

    response = await fetch(url, requestConfig);

    clearTimeout(timeout);

    json = await response.json();

    return json;
};

const getOauthToken = async () => {
    const credentials = {
        client_id: config.CLIENT_ID,
        client_secret: config.CLIENT_SECRET,
        grant_type: 'client_credentials',
        scope: 'public'
    };

    const response = await fetch('https://osu.ppy.sh/oauth/token', {
        method: 'post',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
    });

    const json = await response.json();

    if(json.error != null)
        throw json.error;

    TOKEN = json.access_token;
};

const testApiKey = async () => {
    const response = await fetch(`https://osu.ppy.sh/api/get_beatmaps?k=${config.API_KEY}&b=75`);
    const json = await response.json();

    if (json.error != null) {
        throw json.error;
    }
};

const showApiDetailsDialog = error => {
    const dialog = new QDialog();
    dialog.setObjectName("dialog");
    dialog.setLayout(new FlexLayout());
    
    const labelInfo = new QLabel();

    labelInfo.setText(`
        • Open your <a href="https://osu.ppy.sh/home/account/edit">osu! profile settings</a><br>
        • Scroll down to OAuth section<br>
        • Create a new OAuth application<br>
        • Put any desired name, leave Callback URL empty<br>
        • Enter returned credentials below
    `);

    labelInfo.setObjectName('labelInfo');
    
    const rowClientID = new QWidget();
    rowClientID.setObjectName('rowClientID');
    rowClientID.setLayout(new FlexLayout());
    
    const rowClientSecret = new QWidget();
    rowClientSecret.setObjectName('rowClientSecret');
    rowClientSecret.setLayout(new FlexLayout());
    
    const labelClientID = new QLabel();
    labelClientID.setObjectName("labelClientID");
    labelClientID.setText('Client ID: ');
    
    const inputClientID = new QLineEdit();
    inputClientID.setObjectName("inputClientID");

    if (config.CLIENT_ID > 0) {
        inputClientID.setText(config.CLIENT_ID.toString());
    }
    
    rowClientID.layout.addWidget(labelClientID);
    rowClientID.layout.addWidget(inputClientID);
    
    const labelClientSecret = new QLabel();
    labelClientSecret.setObjectName("labelClientSecret");
    labelClientSecret.setText('Client Secret: ');
    
    const inputClientSecret = new QLineEdit();
    inputClientSecret.setObjectName("inputClientSecret");
    inputClientSecret.setEchoMode(EchoMode.Password);

    if (config.CLIENT_SECRET.length > 0) {
        inputClientSecret.setText(config.CLIENT_SECRET.toString());
    }
    
    rowClientSecret.layout.addWidget(labelClientSecret);
    rowClientSecret.layout.addWidget(inputClientSecret);

    const rowApiKey = new QWidget();
    rowApiKey.setObjectName('rowApiKey');
    rowApiKey.setLayout(new FlexLayout());

    const labelApiKey = new QLabel();
    labelApiKey.setObjectName("labelApiKey");
    labelApiKey.setText('API v1 Key: ');
    
    const inputApiKey = new QLineEdit();
    inputApiKey.setObjectName("inputApiKey");
    inputApiKey.setEchoMode(EchoMode.Password);

    if (config.API_KEY.length > 0) {
        inputApiKey.setText(config.API_KEY.toString());
    }
    
    rowApiKey.layout.addWidget(labelApiKey);
    rowApiKey.layout.addWidget(inputApiKey);
    
    const buttonSave = new QPushButton();
    buttonSave.setText('Save');
    buttonSave.setObjectName('buttonSave');
    
    buttonSave.addEventListener('clicked', async () => {
        config.CLIENT_ID = Number(inputClientID.text());
        config.CLIENT_SECRET = inputClientSecret.text();
        config.API_KEY = inputApiKey.text();

        try {
            await getOauthToken();
            await testApiKey();
            await saveConfig();
            dialog.close();
        } catch(e) {
            dialog.close();
            showApiDetailsDialog(e);
        }
    });
    
    dialog.layout.addWidget(labelInfo);
    dialog.layout.addWidget(rowClientID);
    dialog.layout.addWidget(rowClientSecret);
    dialog.layout.addWidget(rowApiKey);

    if (error) {
        const labelErrorMsg = new QLabel();
        labelErrorMsg.setObjectName("labelErrorMsg");
        labelErrorMsg.setText(error.toString());
        dialog.layout.addWidget(labelErrorMsg);
    }

    dialog.layout.addWidget(buttonSave);
    
    dialog.setStyleSheet(`
        #dialog {
            padding: 10px;
        }
        
        #labelInfo {
            margin-bottom: 5px;
        }
        
        #rowClientID, #rowClientSecret, #rowApiKey {
            flex-direction: row;
        }

        #rowClientSecret {
            margin-top: 5px;
        }
        
        #labelClientID, #labelClientSecret, #labelApiKey {
            min-width: 80px;
        }
        
        #inputClientID, #inputClientSecret, #inputApiKey {
            flex-grow: 1;
        }
        
        #buttonSave {
            margin-top: 8px;
        }

        #labelErrorMsg {
            margin-top: 5px;
            color: red;
        }
    `);

    dialog.layout.setSizeConstraint(nodegui.SizeConstraint.SetFixedSize);
    
    dialog.setWindowTitle("osu! API Credentials");
    dialog.open();
};

const rootView = new QWidget();
rootView.setObjectName("rootView");
rootView.setLayout(new FlexLayout());

const fieldset = new QWidget();
fieldset.setObjectName('fieldset');
fieldset.setLayout(new FlexLayout());

const usernameRow = new QWidget();
usernameRow.setObjectName('usernameRow');
usernameRow.setLayout(new FlexLayout());

const labelUsername = new QLabel();
labelUsername.setText("Username: ");
labelUsername.setObjectName("labelUsername");

const inputUsername = new QLineEdit();
inputUsername.setPlaceholderText("LazyLea");
inputUsername.setObjectName("inputUsername");

usernameRow.layout.addWidget(labelUsername);
usernameRow.layout.addWidget(inputUsername);

const requestsRow = new QWidget();
requestsRow.setObjectName('requestsRow');
requestsRow.setLayout(new FlexLayout());

const labelRequests = new QLabel();
labelRequests.setText("Requests/min: ");
labelRequests.setObjectName("labelRequests");

const inputRequests = new QSpinBox();
inputRequests.setRange(10, 1000);
inputRequests.setValue(60);
inputRequests.setObjectName("inputRequests");

requestsRow.layout.addWidget(labelRequests);
requestsRow.layout.addWidget(inputRequests);

const apiVersionRow = new QWidget();
apiVersionRow.setObjectName('apiVersionRow');
apiVersionRow.setLayout(new FlexLayout());

const labelApiVersion = new QLabel();
labelApiVersion.setText("API Version: ");
labelApiVersion.setObjectName("labelApiVersion");

const inputApiVersion = new QComboBox();
inputApiVersion.addItem(undefined, 'v2');
inputApiVersion.addItem(undefined, 'v1');
inputRequests.setObjectName("inputApiVersion");

apiVersionRow.layout.addWidget(labelApiVersion);
apiVersionRow.layout.addWidget(inputApiVersion);

const buttonsRow = new QWidget();
buttonsRow.setObjectName('buttonsRow');
buttonsRow.setLayout(new FlexLayout());

const buttonCancel = new QPushButton();
buttonCancel.setText('Cancel');
buttonCancel.setEnabled(false);
buttonCancel.setObjectName('buttonCancel');

const buttonFetch = new QPushButton();
buttonFetch.setText('Fetch');
buttonFetch.setObjectName('buttonSave');

buttonsRow.layout.addWidget(buttonCancel);
buttonsRow.layout.addWidget(buttonFetch);

fieldset.layout.addWidget(usernameRow);
fieldset.layout.addWidget(requestsRow);
fieldset.layout.addWidget(apiVersionRow);
fieldset.layout.addWidget(buttonsRow);

const progress = new QProgressBar();
progress.setMaximum(1);
progress.setValue(0);
progress.setFormat("0 / ? beatmaps");
progress.setObjectName("progress");

fieldset.layout.addWidget(progress);

const listExportColumns = new QListWidget();
listExportColumns.setObjectName('listExportColumns');

for(const column of columns){
    const columnItem = new QListWidgetItem();
    columnItem.setText(column);
    columnItem.setCheckState(CheckState.Checked);
    columnItem.setFlags(columnItem.flags() | ItemFlag.ItemIsUserCheckable);

    listExportColumns.addItem(columnItem);
}

fieldset.layout.addWidget(listExportColumns);

const exportButtonsRow = new QWidget();
exportButtonsRow.setObjectName('exportButtonsRow');
exportButtonsRow.setLayout(new FlexLayout());

const buttonExportCsv = new QPushButton();
buttonExportCsv.setText('Export CSV');
buttonExportCsv.setEnabled(false);
buttonExportCsv.setObjectName('buttonExportCsv');

const buttonExportJson = new QPushButton();
buttonExportJson.setText('Export JSON');
buttonExportJson.setEnabled(false);
buttonExportJson.setObjectName('buttonExportJson');

exportButtonsRow.layout.addWidget(buttonExportCsv);
exportButtonsRow.layout.addWidget(buttonExportJson);

fieldset.layout.addWidget(exportButtonsRow);

rootView.layout.addWidget(fieldset);

const rootStyleSheet = `
  #rootView {
    padding: 5px;
  }
  
  #fieldset {
    padding: 5px;
  }
  
  #usernameRow, #buttonsRow, #exportButtonsRow, #requestsRow, #apiVersionRow {
    flex-direction: row;
  }

  #labelUsername, #labelRequests, #labelApiVersion {
    width: 100px;
  }

  #inputUsername, #inputRequests, #inputApiVersion {
    flex-grow: 1;
  }

  #apiVersionRow, #buttonsRow {
    margin-bottom: 10px;
  }

  #exportButtonsRow {
    margin-top: 10px;
  }

  #listExportColumns {
    margin-top: 5px;
  }

  #buttonCancel, #buttonSave, #buttonExportCsv, #buttonExportJson {
    flex-grow: 1;
  }
`;

buttonCancel.addEventListener('clicked', async () => {
    cancelFetch = true;
});

buttonFetch.addEventListener('clicked', async () => {
    cancelFetch = false;

    buttonFetch.setEnabled(false);
    buttonCancel.setEnabled(true);

    let user;

    try{
        user = await apiRequest(`https://osu.ppy.sh/api/v2/users/${inputUsername.text()}`);
    }catch(e){
        console.error(e);

        buttonFetch.setEnabled(true);
        buttonCancel.setEnabled(false);

        return;
    }

    const userId = user.id;

    const beatmapIds = [];
    const limit = 50;

    let offset = 0;
    let beatmaps, beatmapsError;

    do{
        if (cancelFetch) {
            break;
        }

        beatmapsError = null;

        do{
            const timeStart = Date.now();

            try{
                beatmaps = await apiRequest(`https://osu.ppy.sh/api/v2/users/${userId}/beatmapsets/most_played?limit=${limit}&offset=${offset}`);

                if (beatmaps.error) {
                    beatmapsError = beatmaps.error;

                    console.error(beatmaps.error);
                }
            }catch(e){
                console.error(e);
                
                beatmapsError = e.toString();
            }

            const timeTaken = Date.now() - timeStart;
            const sleepTime = Math.max(0, 60000 / inputRequests.value() - timeTaken);

            if (sleepTime > 0) {
                await sleep(Math.max(0, 60000 / inputRequests.value() - timeTaken));
            }

            await sleep(config.WAIT_TIME);
        }while(!Array.isArray(beatmaps) || beatmapsError != null);

        beatmapIds.push(...beatmaps.map(a => a.beatmap_id));

        offset += limit;

        progress.setFormat(`0 / ${beatmapIds.length.toLocaleString()} beatmaps`);
    }while(beatmaps.length > 0);

    if (!cancelFetch) {
        progress.setFormat(`%v / ${beatmapIds.length.toLocaleString()} beatmaps`);
        progress.setMaximum(beatmapIds.length);

        buttonExportJson.setEnabled(true);
        buttonExportCsv.setEnabled(true);
    }

    while (scores.length) {
        scores.pop();
    }

    let score = {};

    for(const [index, beatmapId] of beatmapIds.entries()){
        if (cancelFetch) {
            break;
        }

        if (inputApiVersion.currentText() == 'v2') {
            do{
                const timeStart = Date.now();

                try {
                    score = await apiRequest(`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}/scores/users/${userId}`);

                    if (score.error) {
                        console.error(score.error);
                    }
                } catch(e) {
                    console.error(e);

                    score.error = e.toString();
                }

                const timeTaken = Date.now() - timeStart;
                const sleepTime = Math.max(0, 60000 / inputRequests.value() - timeTaken);

                if (sleepTime > 0) {
                    await sleep(Math.max(0, 60000 / inputRequests.value() - timeTaken));
                }
            }while(score.error != null);
        
            if (score.score != null) {
                score.score.enabled_mods = modsArrayToEnum(score.score.mods);
            }

            score.apiVersion = 2;
        } else {
            do{
                const timeStart = Date.now();

                try {
                    const response = await Promise.all([
                        fetch(`https://osu.ppy.sh/api/get_scores?k=${config.API_KEY}&b=${beatmapId}&u=${userId}&limit=1`),
                        fetch(`${config.BEATMAP_API_BASE}/b/${beatmapId}`)
                    ]);

                    score = {};

                    const scoreJson = await response[0].json();
                    const beatmapJson = await response[1].json();

                    score.score = scoreJson[0];

                    if (Array.isArray(scoreJson) && scoreJson.length > 0) {
                        score.score.beatmap = beatmapJson.beatmap;
                    }
                } catch(e) {
                    console.error(e);

                    score.error = e.toString();
                }

                const timeTaken = Date.now() - timeStart;
                const sleepTime = Math.max(0, 60000 / inputRequests.value() - timeTaken);

                if (sleepTime > 0) {
                    await sleep(Math.max(0, 60000 / inputRequests.value() - timeTaken));
                }
            }while(score.error != null);

            if (score.score != null) {
                score.score.mods = modsEnumToArray(Number(score.score.enabled_mods));
            }

            score.apiVersion = 1;
        }

        if (cancelFetch) {
            break;
        }

        if (score.score != null) {
            scores.push(score);
        }

        progress.setFormat(`${scores.length.toLocaleString()} / ${beatmapIds.length.toLocaleString()} beatmaps`);
        progress.setValue(index + 1);
    }

    buttonFetch.setEnabled(true);
    buttonCancel.setEnabled(false);
});

const getColumn = (column, scoreEntry) => {
    const { score } = scoreEntry;

    if (scoreEntry.apiVersion == 1) {
        switch(column){
            case 'Date':
                return score.date;
            case 'Score ID':
                return score.score_id;
            case 'User ID':
                return score.user_id;
            case 'Beatmapset ID':
                return score.beatmap.beatmapset_id;
            case 'Beatmap ID':
                return score.beatmap.beatmap_id;
            case 'Ranked State':
                return RANKED_STATE[score.beatmap.approved];
            case 'AR':
                return score.beatmap.ar;
            case 'CS':
                return score.beatmap.cs;
            case 'OD':
                return score.beatmap.od;
            case 'HP':
                return score.beatmap.hp;
            case 'BPM':
                return score.beatmap.bpm;
            case 'Version':
                return score.beatmap.version;
            case 'Hit Length':
                return score.beatmap.hit_length;
            case 'Star Rating':
                return score.beatmap.star_rating;
            case 'Mods Array':
                return score.mods.join("");
            case 'Mods Enum':
                return score.enabled_mods;
            case 'Rank':
                return score.rank;
            case 'Position':
                return 0;
            case 'Score':
                return score.score;
            case 'Combo':
                return score.maxcombo;
            case 'FC':
                return score.perfect == "1";
            case 'Accuracy':
                return `${accuracy(score.count50, score.count100, score.count300, score.countmiss).toFixed(2)}%`;
            case '300':
                return score.count300;
            case '100':
                return score.count100;
            case '50':
                return score.count50;
            case 'Miss':
                return score.countmiss;
            case 'PP':
                return score.pp;
            case 'Replay':
                return score.replay == "1";
            default:
                return '';
        }
    } else {
        switch(column){
            case 'Date':
                return score.created_at;
            case 'Score ID':
                return score.id;
            case 'User ID':
                return score.user_id;
            case 'Beatmapset ID':
                return score.beatmap.beatmapset_id;
            case 'Beatmap ID':
                return score.beatmap.id;
            case 'Ranked State':
                return score.beatmap.status;
            case 'AR':
                return score.beatmap.ar;
            case 'CS':
                return score.beatmap.cs;
            case 'OD':
                return score.beatmap.accuracy;
            case 'HP':
                return score.beatmap.drain;
            case 'BPM':
                return score.beatmap.bpm;
            case 'Version':
                return score.beatmap.version;
            case 'Hit Length':
                return score.beatmap.hit_length;
            case 'Star Rating':
                return score.beatmap.difficulty_rating;
            case 'Mods Array':
                return score.mods.join("");
            case 'Mods Enum':
                return score.enabled_mods;
            case 'Rank':
                return score.rank;
            case 'Position':
                return scoreEntry.position;
            case 'Score':
                return score.score;
            case 'Combo':
                return score.max_combo;
            case 'FC':
                return score.perfect;
            case 'Accuracy':
                return `${(score.accuracy * 100).toFixed(2)}%`;
            case '300':
                return score.statistics.count_300;
            case '100':
                return score.statistics.count_100;
            case '50':
                return score.statistics.count_50;
            case 'Miss':
                return score.statistics.count_miss;
            case 'PP':
                return score.pp;
            case 'Replay':
                return score.replay;
            default:
                return '';
        }
    }
}

buttonExportCsv.addEventListener('clicked', async () => {
    const fileDialog = new QFileDialog();

    fileDialog.setFileMode(FileMode.AnyFile);
    fileDialog.setNameFilter('CSV (*.csv)');
    fileDialog.setDefaultSuffix('.csv');
    fileDialog.show();

    fileDialog.addEventListener('fileSelected', async () => {
        const selectedFiles = fileDialog.selectedFiles();
        const outputPath = selectedFiles[0];

        const exportColumns = [];

        for (const item of listExportColumns.items) {
            if (item.checkState() > 0) {
                exportColumns.push(item.text());
            }
        }

        let output = exportColumns.join(",");

        for (const scoreEntry of scores) {
            output += '\r\n';

            for (const [index, column] of exportColumns.entries()) {
                output += getColumn(column, scoreEntry);

                if (index < exportColumns.length - 1) {
                    output += ',';
                }
            }
        }

        await fs.writeFile(outputPath, output);
    });
});

buttonExportJson.addEventListener('clicked', async () => {
    const fileDialog = new QFileDialog();
    
    fileDialog.setFileMode(FileMode.AnyFile);
    fileDialog.setNameFilter('JSON (*.json)');
    fileDialog.setDefaultSuffix('.json');
    fileDialog.show();

    fileDialog.addEventListener('fileSelected', async () => {
        const selectedFiles = fileDialog.selectedFiles();
        const outputPath = selectedFiles[0];

        await fs.writeFile(outputPath, JSON.stringify(scores, null, 2));
    });
});

rootView.setStyleSheet(rootStyleSheet);

const win = new QMainWindow();
win.setWindowTitle("Score Fetcher");
win.setCentralWidget(rootView);
win.show();

fs.readFile('./config.json', 'utf8')
.then(configFile => {
    Object.assign(config, JSON.parse(configFile));
}).catch(error => {
    console.error(error);

    saveConfig().catch(console.error);
}).finally(() => {
    testApiKey().then(() => {
        getOauthToken().catch(showApiDetailsDialog);
    }).catch(showApiDetailsDialog);
});

global.win = win;
