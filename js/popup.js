$(function () {
  sync = {
    /**
     * 初始化函数
     */
    init: function () {
      let that = this;
      console.log(1);

      that.base64 = new Base64();
      that.utils = window.utils || {};
      console.log({ that, uitls: that.utils });

      // 码云的API根地址
      that.baseUrl = that.utils.baseUrl;
      that.getCacheUserInfo();
      that.bindEvent();

      const START_TIME = Date.now();

      chrome.storage.local.set({ START_TIME });
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
    getCacheUserInfo: function () {
      let that = this;
      // 从缓存中读取数据并设置到表单中
      // chrome.storage.local.get(['access_token', 'owner', 'repo', 'path', 'branch', 'remember'], function (obj) {
      that.utils.getCacheUserInfo(function (obj) {
        // 插件最开始的状态是记住开关打开了，但是chrome本地缓存中还没有设置值
        if (!obj.remember) {
          if ($('#rememberDot').hasClass('green')) {
            that.saveRememberState('on');
          } else {
            that.saveRememberState('off');
          }
        } else if (obj.remember == 'on') {
          $('#rememberDot').addClass('green');
        } else {
          $('#rememberDot').removeClass('green');
        }
        if ($('#rememberDot').hasClass('green')) {
          if (obj.access_token || obj.owner || obj.repo || obj.path || obj.branch) {
            $('#tbAccessToken').val(obj.access_token);
            $('#tbOwner').val(obj.owner);
            $('#tbRepo').val(obj.repo);
            $('#tbPath').val(obj.path);
            $('#tbBranch').val(obj.branch);
            that.rememberOn();
          }
        }
      });
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

      $('#btnTest').on('click', () => {
        console.log(window);
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
      $('#btnUpload').on('click', function () {
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
        that.getGit(formObj, function (getState, getRes) {
          // 获取浏览器的书签
          that.getBookmarks(function (bookmarks) {
            // 获取码云的内容存在则更新文件，否则更新文件
            if (getState) {
              let sha = getRes.sha;
              that.updateGit(formObj, bookmarks, sha, function (updState, updRes) {
                // 更新成功，则提示，否则提示错误
                if (updState) {
                  $('#successWrap').show();
                  $('.successText').text('Upload Success');
                } else {
                  $('#toast').text(updRes).show();
                }
                $('#loaderWrap').hide();
              });
            } else {
              that.createGit(formObj, bookmarks, function (createState, createRes) {
                // 创建成功，则提示，否则提示错误
                if (createState) {
                  $('#successWrap').show();
                  $('.successText').text('Upload Success');
                } else {
                  $('#toast').text(createRes).show();
                }
                $('#loaderWrap').hide();
              });
            }
          });
        });
      });

      // 点击下载按钮事件
      $('#btnDownload').on('click', function () {
        let formObj = that.createFormObj();
        console.log('formObj: ', formObj);
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
        that.getGit(formObj, function (getState, getRes) {
          // 获取码云的内容存在则创建文件，否则提示文件不存在
          if (getState) {
            let gitContent = that.base64.decode(getRes['content']);
            let bookmarksParent = JSON.parse(gitContent);
            let bookmarks = bookmarksParent[0];
            // 清空书签栏
            that.emptyBookmarks(function () {
              // 等所有书签都清空后开始设置书签
              that.setBookmarks('1', bookmarks);
              $('#successWrap').show();
              $('.successText').text('Download Success');
            });
          } else {
            $('#toast').text('Git文件不存在').show();
          }
          $('#loaderWrap').hide();
        });
      });
    },
    /**
     * 将git获取的内容设置到浏览器书签上去
     */
    setBookmarks: function (parentId, bookmarks) {
      let that = this;
      if (!bookmarks.children || bookmarks.children.length <= 0) {
        return;
      }
      for (let i = 0; i < bookmarks.children.length; i++) {
        let item = bookmarks.children[i];
        chrome.bookmarks.create(
          {
            parentId: parentId,
            index: item.index,
            title: item.title,
            url: item.url,
          },
          function (res) {
            // 判断假如还有子元素则递归调用自身添加
            if (item.children && item.children.length > 0) {
              that.setBookmarks(res.id, item);
            }
          }
        );
      }
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
    /**
     * 获取Gitee上的数据
     * curl -X GET --header 'Content-Type: application/json;charset=UTF-8' 'https://gitee.com/api/v5/repos/xieyf00/chrome/contents/bookmark/bookmark-4.json?access_token=16c6176faea12d4b2dba667872d9b21c&ref=master'
     */
    getGit: function (formObj, fn) {
      let that = this;
      let getUrl =
        that.baseUrl +
        'repos/' +
        formObj.owner +
        '/' +
        formObj.repo +
        '/contents/' +
        formObj.path +
        '?access_token=' +
        formObj.access_token +
        '&ref=' +
        formObj.branch;
      $.ajax({
        type: 'GET',
        url: getUrl,
        crossDomain: true,
        success: function (res) {
          fn && fn(true, res);
        },
        error: function (xhr, textStatus, error) {
          fn && fn(false, error);
        },
      });
    },
    /**
     * 创建Git文件
     * curl -X POST --header 'Content-Type: application/json;charset=UTF-8' 'https://gitee.com/api/v5/repos/xieyf00/chrome/contents/bookmark/bookmark-copy.json' -d '{"access_token":"16c6176faea12d4b2dba667872d9b21c","content":"xxx","message":"xieyangfan commit","branch":"master"}'
     * createContentRaw：文件内容, 要用 base64 编码
     */
    createGit: function (formObj, createContentRaw, fn) {
      let that = this;
      let createContent = that.base64.encode(JSON.stringify(createContentRaw));
      // Git提交信息
      let createMessage = 'Chrome Browser Bookmark Created' + new Date();
      // 构建
      let createData = {};
      createData.access_token = formObj.access_token;
      createData.content = createContent;
      createData.message = createMessage;
      createData.branch = formObj.branch;
      let createUrl = that.baseUrl + 'repos/' + formObj.owner + '/' + formObj.repo + '/contents/' + formObj.path;
      $.ajax({
        type: 'POST',
        url: createUrl,
        data: createData,
        crossDomain: true,
        success: function (res) {
          fn && fn(true, res);
        },
        error: function (xhr, textStatus, error) {
          fn && fn(false, error);
        },
      });
    },
    /**
     * 更新Git文件
     * curl -X PUT --header 'Content-Type: application/json;charset=UTF-8' 'https://gitee.com/api/v5/repos/xieyf00/chrome/contents/bookmark/bookmark-6.json' -d '{"access_token":"16c6176faea12d4b2dba667872d9b21c","content":"InhpZXlhbmdmYW4gMjAxOTA3MjQgMTU0OCI=","sha":"dce85293664c50792d2ebcfc4ede23bf3e1197c2","message":"xieyangfan 20190724 1736","branch":"master"}'
     * updateContentRaw：文件内容, 要用 base64 编码
     * sha：文件的 Blob SHA，可通过 [获取仓库具体路径下的内容] API 获取
     */
    updateGit: function (formObj, updateContentRaw, sha, fn) {
      let that = this;
      let updateContent = that.base64.encode(JSON.stringify(updateContentRaw));
      // Git提交信息
      let updateMessage = 'Chrome Browser Bookmark Updated' + new Date();
      // 构建
      let updateData = {};
      updateData.access_token = formObj.access_token;
      updateData.content = updateContent;
      updateData.message = updateMessage;
      updateData.sha = sha;
      updateData.branch = formObj.branch;
      let updateUrl = that.baseUrl + 'repos/' + formObj.owner + '/' + formObj.repo + '/contents/' + formObj.path;
      $.ajax({
        type: 'PUT',
        url: updateUrl,
        data: updateData,
        crossDomain: true,
        success: function (res) {
          fn && fn(true, res);
        },
        error: function (xhr, textStatus, error) {
          fn && fn(false, error);
        },
      });
    },
    /**
     * 删除Git文件
     * curl -X DELETE --header 'Content-Type: application/json;charset=UTF-8' 'https://gitee.com/api/v5/repos/xieyf00/chrome/contents/bookmark/bookmark-6.json?access_token=16c6176faea12d4b2dba667872d9b21c&sha=dce85293664c50792d2ebcfc4ede23bf3e1197c2&message=Chrome%20Browser%20Bookmark%20Deleted&branch=master'
     * sha：文件的 Blob SHA，可通过 [获取仓库具体路径下的内容] API 获取
     */
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
  sync.init();
});
