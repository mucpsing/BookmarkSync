$(function () {
  sync = {
    /**
     * 初始化函数
     */
    init: function () {
      let that = this;

      that.base64 = new Base64();
      that.utils = window.utils || {};

      // 码云的API根地址
      that.baseUrl = 'https://gitee.com/api/v5/';
      that.getCacheUserInfo();
      that.bindEvent();
    },
    /**
     * 表单收集
     */
    createFormObj: function () {
      let formObj = {};
      formObj.access_token = $('#tbAccessToken').val();
      formObj.owner = $('#tbOwner').val();
      formObj.repo = $('#tbRepo').val();
      formObj.path = $('#tbPath').val();
      formObj.branch = $('#tbBranch').val();
      return formObj;
    },
    /**
     * 弹出窗开始时从缓存读取已经存储的数据
     */
    getCacheUserInfo: async function () {
      let that = this;
      // 从缓存中读取数据并设置到表单中
      // chrome.storage.local.get(['access_token', 'owner', 'repo', 'path', 'branch', 'remember'], function (obj) {
      const userInfo = await that.utils.Store.getUserInfoFromCache();
      if (userInfo) {
        // 插件最开始的状态是记住开关打开了，但是chrome本地缓存中还没有设置值
        if (!userInfo.remember) {
          if ($('#rememberDot').hasClass('green')) {
            that.saveRememberState('on');
          } else {
            that.saveRememberState('off');
          }
        } else if (userInfo.remember == 'on') {
          $('#rememberDot').addClass('green');
        } else {
          $('#rememberDot').removeClass('green');
        }
        if ($('#rememberDot').hasClass('green')) {
          if (userInfo.access_token || userInfo.owner || userInfo.repo || userInfo.path || userInfo.branch) {
            $('#tbAccessToken').val(userInfo.access_token);
            $('#tbOwner').val(userInfo.owner);
            $('#tbRepo').val(userInfo.repo);
            $('#tbPath').val(userInfo.path);
            $('#tbBranch').val(userInfo.branch);
            that.rememberOn();
          }
        }
      }
    },
    rememberOn: function () {
      let that = this;
      $('#rememberText').addClass('grey');
      $('#rememberDot').addClass('green');
      that.saveRememberState('on');
    },
    rememberOff: function () {
      let that = this;
      $('#rememberText').removeClass('grey');
      $('#rememberDot').removeClass('green');
      that.saveRememberState('off');
    },
    /**
     * 清除用户信息
     */
    clearUserInfo: function () {
      chrome.storage.local.clear(function () {
        console.log('clear user info success');
      });
    },
    /**
     * 保存用户信息
     */
    saveUserInfo: function () {
      let that = this;
      let formObj = that.createFormObj();
      chrome.storage.local.set(formObj, function () {
        console.log('save user info success');
      });
    },
    /**
     * 保存记住按钮的状态
     * state：on（记住），off（不记住）
     */
    saveRememberState: function (state) {
      let rememberObj = {};
      rememberObj.remember = state;
      chrome.storage.local.set(rememberObj, function () {
        console.log('save remember state success');
      });
    },
    /**
     * 获取浏览器的书签数据
     */
    getBookmarks: function (fn) {
      // 获取整个书签树（包括书签栏和其他书签，相当于chrome.bookmarks.getSubTree("0", fn)）
      // chrome.bookmarks.getTree(fn);
      // 0-根目录 1-书签栏 2-其他书签
      chrome.bookmarks.getSubTree('1', fn);
    },
    /**
     * 清空书签栏文件夹（不能直接清除根书签栏，只能遍历一个一个文件夹清除）
     */
    emptyBookmarks: function (fn) {
      chrome.bookmarks.getChildren('1', function (children) {
        // 需要判断书签栏是否原来就是空的
        if (children.length <= 0) {
          fn();
          return;
        }
        for (let i = 0; i < children.length; i++) {
          let item = children[i];
          chrome.bookmarks.removeTree(item.id, function () {
            // 判断是不是已经删除到最后一个了，是的话就调用回调函数
            if (i == children.length - 1) {
              fn();
            }
          });
        }
      });
    },
    bindEvent: function () {
      let that = this;
      $('#btnTest').on('click', async () => {});

      $('#btnClean').on('click', async () => {
        that.utils.Bookmark.emptyBookmarks()
      });


      // 记住按钮点击事件
      $('#rememberDot').on('click', function () {
        // 先判断当前记住按钮的状态，假如已经记住则不再记住，清空缓存
        if ($('#rememberDot').hasClass('green')) {
          that.clearUserInfo();
          that.rememberOff();
        } else {
          // 获取表单数据，有则保存到缓存中
          let formObj = that.createFormObj();
          let existRes = that.checkFormExist(formObj);
          if (existRes) {
            that.saveUserInfo();
          }
          that.rememberOn();
        }
      });

      // 输入框的输入事件，用来记忆表单数据
      $('.input').on('input', function () {
        if ($('#rememberDot').hasClass('green')) {
          that.saveUserInfo();
          that.rememberOn();
        }
      });

      // 点击上传按钮
      $('#btnUpload').on('click', async function () {
        let formObj = that.createFormObj();
        let formRes = that.checkForm(formObj);
        if (formRes != 'ok') {
          $('#toast').text(formRes).show();
          return;
        }
        // 假如记住按钮已经点击了
        if ($('#rememberDot').hasClass('green')) {
          that.saveUserInfo();
          that.rememberOn();
        } else {
          that.clearUserInfo();
          that.rememberOff();
        }
        $('#loaderWrap').show();
        const { sha } = await that.utils.Gitee.getGit(formObj);
        const bookmarks = await that.utils.Bookmark.getBookmarks();
        if (bookmarks) {
          that.utils.Gitee.updateGit(formObj, bookmarks, sha).then(upRes => {
            // 更新成功，则提示，否则提示错误
            if (upRes) {
              $('#successWrap').show();
              $('.successText').text('Upload Success');
            } else {
              $('#toast').text('upload fails').show();
            }
            $('#loaderWrap').hide();
          });
        } else {
          that.utils.Gitee.createGit(formObj, bookmarks, sha).then(createRes => {
            // 创建成功，则提示，否则提示错误
            if (createRes) {
              $('#successWrap').show();
              $('.successText').text('Upload Success');
            } else {
              $('#toast').text('upload fails').show();
            }
            $('#loaderWrap').hide();
          });
        }
      });

      // 点击下载按钮事件
      $('#btnDownload').on('click', async function () {
        let formObj = that.createFormObj();
        let formRes = that.checkForm(formObj);

        if (formRes != 'ok') {
          $('#toast').text(formRes).show();
          return;
        }

        // 假如记住按钮已经点击了
        if ($('#rememberDot').hasClass('green')) {
          that.saveUserInfo();
          that.rememberOn();
        } else {
          that.clearUserInfo();
          that.rememberOff();
        }
        $('#loaderWrap').show();

        // 从码云上获取书签内容
        // 获取浏览器的书签
        const { bookmarks } = await that.utils.Gitee.getGit(formObj);
        if (bookmarks) {
          that.utils.Bookmark.emptyBookmarks().then(() => {
            // 等所有书签都清空后开始设置书签
            // that.setBookmarks('1', bookmarks);
            that.utils.Bookmark.setBookmarks('1', bookmarks);
            $('#successWrap').show();
            $('.successText').text('Download Success');
          });
        } else {
          $('#toast').text('Git文件不存在').show();
        }

        $('#loaderWrap').hide();
      });
    },

    /**
     * 校验表单
     */
    checkForm: function (formObj) {
      if (!formObj.access_token) {
        $('#tbAccessToken').addClass('error');
        return 'access_token is required';
      }
      $('#tbAccessToken').removeClass('error');

      if (!formObj.owner) {
        $('#tbOwner').addClass('error');
        return 'owner is required';
      }
      $('#tbOwner').removeClass('error');

      if (!formObj.repo) {
        $('#tbRepo').addClass('error');
        return 'repo is required';
      }
      $('#tbRepo').removeClass('error');

      if (!formObj.path) {
        $('#tbPath').addClass('error');
        return 'path is required';
      }
      $('#tbPath').removeClass('error');

      if (!formObj.branch) {
        $('#tbBranch').addClass('error');
        return 'branch is required';
      }
      $('#tbBranch').removeClass('error');
      return 'ok';
    },
    /**
     * 查看表单是否至少有一个值
     */
    checkFormExist: function (formObj) {
      if (formObj.access_token != '') {
        return true;
      }
      if (formObj.owner != '') {
        return true;
      }
      if (formObj.repo != '') {
        return true;
      }
      if (formObj.path != '') {
        return true;
      }
      if (formObj.branch != '') {
        return true;
      }
      return false;
    },
  };
  sync.init();
});
