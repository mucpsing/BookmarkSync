/*!
 * @Author: CPS
 * @email: 373704015@qq.com
 * @Date: 2024-09-25 16:20:10.216110
 * @Last Modified by: CPS
 * @Last Modified time: 2024-09-25 16:20:10.216110
 * @Projectname
 * @file_path "W:\CPS\Chrome\插件\书签同步码云\js"
 * @Filename "utils.js"
 * @Description: 提纯一些工具性质的api，将相同功能的api集中到当前文件先，后续再进行解耦优化
 */

'use strict';
const createBase64 = () => new Base64();
const base64 = createBase64();

const Bookmark = {
  setBookmarks: async function (parentId, bookmarks) {
    if (!bookmarks.children || bookmarks.children.length <= 0) {
      return;
    }

    for (let i = 0; i < bookmarks.children.length; i++) {
      let item = bookmarks.children[i];
      try {
        const res = await new Promise((resolve, reject) => {
          const newItem = { parentId: parentId, index: item.index, title: item.title, url: item.url };
          chrome.bookmarks.create(newItem, function (newBookmark) {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(newBookmark);
            }
          });
        });

        // 判断假如还有子元素则递归调用自身添加
        if (item.children && item.children.length > 0) {
          await this.setBookmarks(res.id, item);
        }
      } catch (error) {
        console.error('Error creating bookmark:', error);
      }
    }
  },

  getBookmarks: function () {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getSubTree('1', bookmarks => {
        if (chrome.runtime.lastError) {
          // 如果发生错误，则拒绝Promise
          reject(chrome.runtime.lastError);
        } else {
          // 否则，解决Promise并返回获取到的数据
          resolve(bookmarks);
        }
      });
    });
  },

  getBookmarkChildren: function () {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren('1', function (children) {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(children);
        }
      });
    });
  },

  removeBookmarkTree: function (item) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.removeTree(item.id, function () {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  },

  emptyBookmarks: async function () {
    try {
      // 获取书签栏的子书签
      const children = await this.getBookmarkChildren();

      // 如果书签栏为空，则直接返回true
      if (children.length === 0) return true;

      // 逐个删除书签
      for (const item of children) await this.removeBookmarkTree(item);

      // 如果所有书签都被删除了，则返回true
      return true;
    } catch (error) {
      console.error('Error emptying bookmarks:', error);
      return false;
    }
  },
};

const Gitee = {
  baseUrl: 'https://gitee.com/api/v5/',
  getGit: async function (options) {
    try {
      const { baseUrl, owner, repo, path, access_token, branch } = options;

      // 构造完整的URL
      const url = `${baseUrl || this.baseUrl}/repos/${owner}/${repo}/contents/${path}?access_token=${access_token}&ref=${branch}`;

      // 发起AJAX请求，并使用await等待结果
      const response = await $.ajax({ type: 'GET', url: url, crossDomain: true });

      if (response.content) {
        const gitContent = base64.decode(response.content);
        const bookmarksParent = JSON.parse(gitContent);
        const bookmarks = bookmarksParent[0];
        return { bookmarks, sha: response.sha };
      }

      return false;
    } catch (error) {
      // 捕获并处理错误
      // throw new Error(`Failed to fetch Git repository: ${error.message}`);
      return false;
    }
  },

  updateGit: async function (options, bookmarksData, sha) {
    try {
      const { baseUrl, owner, repo, path, access_token, branch } = options;

      let content = base64.encode(JSON.stringify(bookmarksData));
      let message = 'Chrome Browser Bookmark Updated' + new Date();

      // 构造body
      const data = { access_token, content, message, sha, branch };

      // 拼接url
      const url = `${baseUrl || this.baseUrl}repos/${owner}/${repo}/contents/${path}`;

      return await $.ajax({ type: 'PUT', url, data, crossDomain: true });
    } catch (error) {
      // 捕获并处理错误
      throw new Error(`Failed to fetch Git repository: ${error.message}`);
    }
  },

  createGit: async function (options, bookmarks) {
    try {
      let content = base64.encode(JSON.stringify(bookmarks));

      // Git提交信息
      const message = 'Chrome Browser Bookmark Created' + new Date();

      // 构建body
      const { baseUrl, access_token, branch, owner, repo, path } = options;
      const data = { access_token, branch, content, message };
      const url = `${baseUrl || this.baseUrl}repos/${owner}/${repo}/contents/${path}`;

      return await $.ajax({ type: 'POST', url, data, crossDomain: true });
    } catch (error) {
      // 捕获并处理错误
      throw new Error(`Failed to fetch Git repository: ${error}`);
    }
  },
  deleteGit: function (formObj, sha, fn) {
    let that = this;
    // Git提交信息
    let deleteMessage = 'Chrome Browser Bookmark Deleted' + new Date();
    // 构建
    let deleteData = {};
    deleteData.access_token = formObj.access_token;
    deleteData.message = deleteMessage;
    deleteData.sha = sha;
    deleteData.branch = formObj.branch;
    let deleteUrl = that.baseUrl + 'repos/' + formObj.owner + '/' + formObj.repo + '/contents/' + formObj.path;
    $.ajax({
      type: 'DELETE',
      url: deleteUrl,
      data: deleteData,
      crossDomain: true,
      success: function (res) {
        fn && fn(true, res);
      },
      error: function (xhr, textStatus, error) {
        fn && fn(false, error);
      },
    });
  },
};

const Store = {
  getUserInfoFromCache: function () {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['access_token', 'owner', 'repo', 'path', 'branch', 'remember'], obj => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          if (obj) resolve(obj);

          resolve(false);
        }
      });
    });
  },
};

const utils = {
  getCacheUserInfo: callback => {
    chrome.storage.local.get(['access_token', 'owner', 'repo', 'path', 'branch', 'remember'], callback);
  },
  base64,
  createBase64,
  Gitee,
  Store,
  Bookmark,
};

window.utils = utils;

console.log('utils.js init1');
