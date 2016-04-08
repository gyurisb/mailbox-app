'use strict';

const Hello = require('./main/hello.js');
const EmailConnection = require('./main/email.js');
const electron = require('electron');
// Module to control application life.
const app = electron.app;
const ipcMain = electron.ipcMain;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;
// Module to create menus
const Menu = require('menu');
const MenuItem = require('menu-item');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1200, height: 700});
  //mainWindow.setMenu(null);
  var template = [
      {
          label: 'File',
          submenu: [
            {
                label: "Open"
            },
            {
                label: "Save",
                accelerator: 'Command+S'
            },
            {
                label: "Exit",
            }
          ]
      },
      {
          label: "Debug",
          submenu: [
            {
                label: "Open inspection",
                click: function() {
                mainWindow.webContents.openDevTools();
                }
            }
          ]
      }
  ];
  var menu = Menu.buildFromTemplate(template);
  mainWindow.setMenu(menu);

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/renderer/index.html');

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

var conn;

ipcMain.on('loginAsync', function(event, arg) {
    conn = new EmailConnection();
    conn.login(arg, function() {
        event.sender.send('loginReply', true);
    }, function(err){
        event.sender.send('loginError', err);
    });
});

ipcMain.on('getFoldersAsync', function(event, arg){
    conn.getFolders(function(mailboxes) {
        event.sender.send('getFoldersReply', mailboxes);
    }, function(err){
        event.sender.send('getFoldersError', err);
    });
});

ipcMain.on('getEmailsAsync', function(event, path){
    conn.getEmails(path, function(messages) {
        event.sender.send('getEmailsReply', messages);
    }, function(err){
        event.sender.send('getEmailsError', err);
    });
});

ipcMain.on('getEmailBodyAsync', function(event, arg) {
    conn.getEmailBody(arg.uid, function(body) {
        event.sender.send('getEmailBodyReply', body);
    }, function(err){
        event.sender.send('getEmailBodyError', err);
    });
});

ipcMain.on('sendEmailAsync', function(event, arg) {
    conn.sendEmail(arg, function() {
        event.sender.send('sendEmailReply', true);
    }, function(err){
        event.sender.send('sendEmailError', err);
    });
});

ipcMain.on('openNewEmailWindow', function(event, arg) {
  var newWindow = new BrowserWindow({width: 800, height: 600});
  var template = [
      {
          label: "Debug",
          submenu: [
            {
                label: "Open inspection",
                click: function() {
                newWindow.webContents.openDevTools();
                }
            }
          ]
      }
  ];
  var menu = Menu.buildFromTemplate(template);
  newWindow.setMenu(menu);
  newWindow.loadURL('file://' + __dirname + '/renderer/new.html');
  newWindow.on('closed', function() {});
});