var ngApp = angular.module('emailApp', ['ngAnimate', 'ngMaterial', 'ui.tinymce']);
var loggedIn = false;

ngApp.config(function($mdThemingProvider, $mdIconProvider) {
    // Configure a dark theme with primary foreground yellow
    $mdThemingProvider.theme('docs-dark', 'default')
        .primaryPalette('yellow')
        .dark();
    //Configure icons
    $mdIconProvider
       .defaultFontSet('fa fa-lg');
});

ngApp.directive('statusBar', function(){
   return {
       restrict: 'EA',
       templateUrl: 'partials/statusBar.html',
   }; 
});