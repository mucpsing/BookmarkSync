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
function checkLocalBookmark(){}
function main() {
  ['onCreated', 'onChanged', 'onRemoved', 'onMoved', 'onChildrenReordered'].forEach(action => {
    chrome.bookmarks[action].addListener(async function () {
      const bookmarks = await utils.Bookmark.getBookmarks();

      const options = await utils.Store.getUserInfoFromCache();

      const { _, sha } = await utils.Gitee.getGit(options);

      const updateRes = await utils.Gitee.updateGit(options, bookmarks, sha);

      // 进行提示
    });
  });
}

setTimeout(main, 500);
