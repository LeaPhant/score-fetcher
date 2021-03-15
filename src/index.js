import nodegui from '@nodegui/nodegui';
import fetch from 'node-fetch';
import { promises as fs } from 'fs';

const { 
    QMainWindow,
    QWidget,
    FlexLayout,
    QDialog,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    ItemFlag,
    CheckState,
    QPushButton,
    QProgressBar,
    QFileDialog,
    FileMode,
    EchoMode
} = nodegui;

const WAIT_TIME = 500;

const config = {
    CLIENT_ID: 0,
    CLIENT_SECRET: ""
};

const scores = [];

const columns = [
    "Date","Score ID","User ID","Beatmapset ID","Beatmap ID","Ranked State","AR","CS","OD","HP","BPM","Version","Length",
    "Star Rating","Mods","Rank","Position","Score","Combo","FC","Accuracy","300","100","50","Miss","PP","Replay"
];

let TOKEN;
let cancelFetch = false;

const saveConfig = async () => {
    await fs.writeFile('./config.json', JSON.stringify(config, null, 2));
};

const sleep = ms => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const apiRequest = async url => {
    const requestConfig = {
        method: 'get',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`
        },
    };

    let response = await fetch(url, requestConfig);
    let json = await response.json();

    if (json.authentication == 'basic') {
        await getOauthToken();
    } else {
        return json;
    }

    requestConfig.headers['Authorization'] = `Bearer ${TOKEN}`;

    response = await fetch(url, requestConfig);
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
    const rowClientIDLayout = new FlexLayout();
    rowClientID.setObjectName('rowClientID');
    rowClientID.setLayout(rowClientIDLayout);
    
    const rowClientSecret = new QWidget();
    const rowClientSecretLayout = new FlexLayout();
    rowClientSecret.setObjectName('rowClientSecret');
    rowClientSecret.setLayout(rowClientSecretLayout);
    
    const labelClientID = new QLabel();
    labelClientID.setObjectName("labelClientID");
    labelClientID.setText('Client ID: ');
    
    const inputClientID = new QLineEdit();
    inputClientID.setObjectName("inputClientID");

    if (config.CLIENT_ID > 0) {
        inputClientID.setText(config.CLIENT_ID.toString());
    }
    
    rowClientIDLayout.addWidget(labelClientID);
    rowClientIDLayout.addWidget(inputClientID);
    
    const labelClientSecret = new QLabel();
    labelClientSecret.setObjectName("labelClientSecret");
    labelClientSecret.setText('Client Secret: ');
    
    const inputClientSecret = new QLineEdit();
    inputClientSecret.setObjectName("inputClientSecret");
    inputClientSecret.setEchoMode(EchoMode.Password);

    if (config.CLIENT_SECRET.length > 0) {
        inputClientSecret.setText(config.CLIENT_SECRET.toString());
    }
    
    rowClientSecretLayout.addWidget(labelClientSecret);
    rowClientSecretLayout.addWidget(inputClientSecret);
    
    const buttonSave = new QPushButton();
    buttonSave.setText('Save');
    buttonSave.setObjectName('buttonSave');
    
    buttonSave.addEventListener('clicked', async () => {
        config.CLIENT_ID = Number(inputClientID.text());
        config.CLIENT_SECRET = inputClientSecret.text();

        dialog.close();

        try {
            await getOauthToken();
            await saveConfig();
        } catch(e) {
            showApiDetailsDialog(e);
        }
    });
    
    dialog.layout.addWidget(labelInfo);
    dialog.layout.addWidget(rowClientID);
    dialog.layout.addWidget(rowClientSecret);

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
        
        #rowClientID, #rowClientSecret {
            flex-direction: row;
        }

        #rowClientSecret {
            margin-top: 5px;
        }
        
        #labelClientID, #labelClientSecret {
            min-width: 80px;
        }
        
        #inputClientID, #inputClientSecret {
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
    dialog.exec();
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
  
  #usernameRow, #buttonsRow, #exportButtonsRow {
    flex-direction: row;
  }

  #usernameRow, #buttonsRow {
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

  #inputUsername {
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

    const user = await apiRequest(`https://osu.ppy.sh/api/v2/users/${inputUsername.text()}`);

    const { id } = user;

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
            try{
                beatmaps = await apiRequest(`https://osu.ppy.sh/api/v2/users/${id}/beatmapsets/most_played?limit=${limit}&offset=${offset}`);

                if (beatmaps.error) {
                    beatmapsError = beatmaps.error;
                    
                    console.error(beatmaps.error);
                }
            }catch(e){
                console.error(e);
                
                beatmapsError = e.toString();
            }
        }while(beatmapsError != null)       

        beatmapIds.push(...beatmaps.map(a => a.beatmap_id));

        offset += limit;

        progress.setFormat(`0 / ${beatmapIds.length.toLocaleString()} beatmaps`);

        await sleep(WAIT_TIME);
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

        do{
            try{
                score = await apiRequest(`https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}/scores/users/${id}`);

                if (score.error) {
                    console.error(score.error);
                }
            }catch(e){
                console.error(e);

                score.error = e.toString();
            }

            await sleep(WAIT_TIME);
        }while(score.error != null);
        
        if (cancelFetch) {
            break;
        }

        if (score.score != null) {
            scores.push(score);
        }

        progress.setValue(index + 1);
    }

    buttonFetch.setEnabled(true);
    buttonCancel.setEnabled(false);
});

const getColumn = (column, scoreEntry) => {
    const { score } = scoreEntry;

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
        case 'Mods':
            return score.mods.join(",");
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

buttonExportCsv.addEventListener('clicked', async () => {
    const fileDialog = new QFileDialog();

    fileDialog.setFileMode(FileMode.AnyFile);
    fileDialog.setNameFilter('CSV (*.csv)');
    fileDialog.setDefaultSuffix('.csv');
    fileDialog.exec();

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

buttonExportJson.addEventListener('clicked', async () => {
    const fileDialog = new QFileDialog();
    
    fileDialog.setFileMode(FileMode.AnyFile);
    fileDialog.setNameFilter('JSON (*.json)');
    fileDialog.setDefaultSuffix('.json');
    fileDialog.exec();

    const selectedFiles = fileDialog.selectedFiles();
    const outputPath = selectedFiles[0];

    await fs.writeFile(outputPath, JSON.stringify(scores, null, 2));
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
    getOauthToken().catch(showApiDetailsDialog);
});

global.win = win;
