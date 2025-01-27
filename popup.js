/* eslint-disable no-console */
/* global browser Notify */

const notify = new Notify(document.querySelector('#notify'));
var resultList = document.getElementById('resultList');
var searchInput = document.getElementById('vault-search');
var searchRegex, vaultServerAdress, vaultToken, secretList;

async function mainLoaded() {
  var tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
    var tab = tabs[tabIndex];
    if (tab.url) {
      searchRegex = tab.url;
      break;
    }
  }

  if (searchInput.value.length != 0) {
    searchRegex = searchInput.value;
  }

  vaultToken = (await browser.storage.local.get('vaultToken')).vaultToken;
  if (!vaultToken || vaultToken.length === 0) {
    return notify.clear().info(
      `No Vault-Token information available.<br>
      Please use the <a href="/options.html" class="link">options page</a> to login.`,
      { removeOption: false }
    );
  }

  vaultServerAdress = (await browser.storage.sync.get('vaultAddress'))
    .vaultAddress;

  secretList = (await browser.storage.sync.get('secrets')).secrets;
  if (!secretList) {
    secretList = [];
  }
  querySecrets(searchRegex, (searchInput.value.length != 0));
}

async function querySecrets(searchString, manualSearch) {
  resultList.textContent = '';
  var promises = [];
  let anyMatch = false;
  notify.clear();
  for (const secret of secretList) {
    promises.push(
      (async function () {
        var secretsInPath = await fetch(
          `${vaultServerAdress}/v1/secret/metadata/vaultPass/${secret}`,
          {
            method: 'LIST',
            headers: {
              'X-Vault-Token': vaultToken,
              'Content-Type': 'application/json',
            },
          }
        );
        if (!secretsInPath.ok) {
          notify.error(`Token is not able to read ${secret}... Try re-login`, {
            removeOption: true,
          });
          return;
        }
        for (const element of (await secretsInPath.json()).data.keys) {
          var pattern = new RegExp(element);
          var patternMatches = (pattern.test(searchString) || element.includes(searchString));
          if (patternMatches) {
            const urlPath = `${vaultServerAdress}/v1/secret/data/vaultPass/${secret}${element}`;
            const credentials = await getCredentials(urlPath);
            addCredentialsToList(credentials.data.data, element, resultList);
            anyMatch = true;
            notify.clear();
          }
        }
      })()
    );
  }

  try {
    await Promise.all(promises);
    if (!anyMatch && !manualSearch) {
      notify.info('No matching key found for this page.', {
        removeOption: false,
      });
    } else if (!anyMatch) {
      notify.info('No matching key found for the search', {
        removeOption: false,
      });
    }
  } catch (err) {
    notify.clear().error(err.message);
  }
}

const searchHandler = function (e) {
  if (e.key === 'Enter') {
    mainLoaded()
  }
};

searchInput.addEventListener('keyup', searchHandler);

function addCredentialsToList(credentials, credentialName, list) {
  const item = document.createElement('li');
  item.classList.add('list__item', 'list__item--three-line');

  const primaryContent = document.createElement('button');
  primaryContent.title = 'insert credentials';
  primaryContent.classList.add(
    'list__item-primary-content',
    'list__item-button',
    'nobutton',
    'js-button',
    'js-ripple-effect'
  );
  primaryContent.addEventListener('click', function () {
    fillCredentialsInBrowser(credentials.username, credentials.password);
  });
  item.appendChild(primaryContent);

  const titleContent = document.createElement('span');
  titleContent.classList.add('list__item-text-title', 'link');
  titleContent.textContent = credentials.title || credentialName;
  primaryContent.appendChild(titleContent);

  const detailContent = document.createElement('span');
  detailContent.classList.add('list__item-text-body');
  detailContent.textContent = `User: ${credentials.username}`;
  primaryContent.appendChild(detailContent);

  const actions = document.createElement('div');
  actions.classList.add('list__item-actions');
  item.appendChild(actions);

  const copyUsernameButton = document.createElement('button');
  copyUsernameButton.classList.add('button');
  copyUsernameButton.title = 'copy username to clipboard';
  copyUsernameButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
      <use href="icons/copy-user.svg#copy-user"/>
    </svg>
  `;
  copyUsernameButton.addEventListener('click', function () {
    copyStringToClipboard(credentials.username);
  });
  actions.appendChild(copyUsernameButton);

  const copyPasswordButton = document.createElement('button');
  copyPasswordButton.classList.add('button');
  copyPasswordButton.title = 'copy password to clipboard';
  copyPasswordButton.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="icon icon--inline">
      <use href="icons/copy-key.svg#copy-key"/>
    </svg>
  `;
  copyPasswordButton.addEventListener('click', function () {
    copyStringToClipboard(credentials.password);
  });
  actions.appendChild(copyPasswordButton);

  list.appendChild(item);
}

async function getCredentials(urlPath) {
  const vaultToken = (await browser.storage.local.get('vaultToken')).vaultToken;
  const result = await fetch(urlPath, {
    headers: {
      'X-Vault-Token': vaultToken,
      'Content-Type': 'application/json',
    },
  });
  if (!result.ok) {
    throw new Error(`getCredentials: ${await result.text}`);
  }
  return await result.json();
}

async function fillCredentialsInBrowser(username, password) {
  var tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
    var tab = tabs[tabIndex];
    if (tab.url) {
      // tabs.sendMessage(integer tabId, any message, optional object options, optional function responseCallback)

      browser.tabs.sendMessage(tab.id, {
        message: 'fill_creds',
        username: username,
        password: password,
      });
      break;
    }
  }
}

async function copyStringToClipboard(string) {
  var tabs = await browser.tabs.query({ active: true, currentWindow: true });
  for (let tabIndex = 0; tabIndex < tabs.length; tabIndex++) {
    var tab = tabs[tabIndex];
    if (tab.url) {
      browser.tabs.sendMessage(tab.id, {
        message: 'copy_to_clipboard',
        string: string,
      });
      break;
    }
  }
}

document.addEventListener('DOMContentLoaded', mainLoaded, false);
