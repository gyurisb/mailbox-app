// app.config(function($stateProvider, $urlRouterProvider) {
//   $urlRouterProvider.otherwise("/login");
//   $stateProvider
//     .state('login', {
//       url: "/login?ref&message&dev&code",
//       templateUrl: "partials/login.html",
//       controller: 'LoginController',
//       onEnter: function($state){
//           if (loggedIn) {
//             $state.go('main');
//           }
//       }
//     })
//     .state('folders', {
//       url: "/folders?loggedIn",
//       templateUrl: "partials/folders.html",
//       controller: 'FoldersController',
//     })
//     .state('emails', {
//       url: "/emails?path",
//       templateUrl: "partials/emails.html",
//       controller: 'EmailsController',
//     })
//     .state('reader', {
//       url: "/reader?uid",
//       templateUrl: "partials/reader.html",
//       controller: 'ReaderController',
//     });
// });