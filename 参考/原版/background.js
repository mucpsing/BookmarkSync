/*!
 * @Author: CPS
 * @email: 373704015@qq.com
 * @Date: 2024-09-25 16:20:10.216110
 * @Last Modified by: CPS
 * @Last Modified time: 2024-09-25 16:20:10.216110
 * @Projectname
 * @file_path "W:\CPS\Chrome\插件\书签同步码云"
 * @Filename "background.js"
 * @Description: 后台每次开启的时候执行一次DownLoad
 */

'use strict';
// 首次启动检查收藏夹是否有更新
// function checkLocalBookmark(){}

async function updateBookmark() {
  const bookmarks = await utils.Bookmark.getBookmarks();

  const options = await utils.Store.getUserInfoFromCache();

  const { _, sha } = await utils.Gitee.getGit(options);

  const updateRes = await utils.Gitee.updateGit(options, bookmarks, sha);

  console.log('updateBookmark: ', { updateRes });

  // 进行提示
  utils.Message.alter('触发更新');
}

function bingEvents() {
  const onAction = ['onCreated', 'onChanged', 'onRemoved', 'onMoved', 'onChildrenReordered'];
  onAction.forEach(action => chrome.bookmarks[action].addListener(updateBookmark));
}

function unBingEvents() {
  const onAction = ['onCreated', 'onChanged', 'onRemoved', 'onMoved', 'onChildrenReordered'];
  onAction.forEach(action => chrome.bookmarks[action].removeListener(updateBookmark));
}

async function main() {
  const defaultState = { showUpdateTip: false };
  await utils.Store.setState(defaultState);

  bingEvents();

  chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    switch (request) {
      case 'bingEvents':
        // console.log('bingEvents');
        bingEvents();

        break;
      case 'unBingEvents':
        // console.log('unBingEvents');
        unBingEvents();
        break;
    }
  });
}

setTimeout(main, 500);
