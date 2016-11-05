ngApp.directive('folder', function(){
   return {
       restrict: 'E',
       scope: {
        folder: '=model',
        selectedFolder: '=',
        folderClicked: '=',
        closeds: "=?"
       },
       templateUrl: 'partials/folder.html',
       link: function(scope, element) {
           scope.close = function($event) {
               $event.stopPropagation();
               scope.closeds[scope.folder.path] = true;
           };
           scope.open = function($event) {
               $event.stopPropagation();
               delete scope.closeds[scope.folder.path];
           };
           scope.hasChildren = function() {
               return scope.folder.children !== undefined && scope.folder.children.length > 0;
           };
           scope.getHeight = function() {
               var eHeight = parseInt($(element).find(':first-child').css('max-height'));
               return scope.folder.children.length * eHeight;
           }
           if (!scope.closeds) {
               scope.closeds = {};
           }
       }
   }; 
});