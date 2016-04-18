var app = angular.module('emailApp', ['ngAnimate', 'ngMaterial']);
var loggedIn = false;

var mainScope;

app.config(function($mdThemingProvider, $mdIconProvider) {
    // Configure a dark theme with primary foreground yellow
    $mdThemingProvider.theme('docs-dark', 'default')
        .primaryPalette('yellow')
        .dark();
    //Configure icons
    $mdIconProvider
       .defaultFontSet('fa fa-lg');
});


app.directive('mailboxLayout', function(){
   return {
       restrict: 'AE',
       templateUrl: 'partials/layout.html'
   }; 
});
app.directive('mailboxNew', function(){
   return {
       restrict: 'AE',
       templateUrl: 'partials/new.html'
   }; 
});