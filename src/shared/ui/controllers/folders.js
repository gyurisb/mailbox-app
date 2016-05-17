ngApp.controller('FoldersController', ['$scope', '$mailbox', '$app', '$master', function($scope, $mailbox, $app, $master) {

    $scope.selectedFolder = null;
    $scope.updatedFolders = {};
    
    function foldersLoaded(root) {
        $scope.root = root;
        if ($scope.selectedFolder == null)
            $scope.selectedFolder = root.children[0].path;
    }
    
    $app.onLogin(function(){
        $master.focus(1);
        $mailbox.getFolders().success(foldersLoaded);
    });
    
    $mailbox.onMailboxUpdate().success(function(){
        $mailbox.getFolders().success(foldersLoaded);
    });
    
    // $mailbox.onFolderUpdate().success(function(args){
    //     $scope.updatedFolders[args.folder.path] = true;
    // });
    
    $scope.folderClicked = function(folder) {
        $scope.selectedFolder = folder.path;
        $app.focusFolder(folder);
    }
    
    $scope.times = function(size) {
        return new Array(size);
    }    
}]);

ngApp.directive('mailboxFolder', function(){
   return {
       restrict: 'E',
       scope: {
        folder: '=model',
        selectedFolder: '=selectedFolder',
        folderClicked: '=folderClicked',
        updatedFolders: "=updatedFolders"
       },
       templateUrl: 'partials/folder.directive.html',
       link: function(scope, element) {
           scope.close = function($event) {
               $event.stopPropagation();
               scope.folder.closed = true;
           };
           scope.open = function($event) {
               $event.stopPropagation();
               scope.folder.closed = undefined;
           };
           scope.hasChildren = function() {
               return scope.folder.children !== undefined && scope.folder.children.length > 0;
           };
           scope.getHeight = function() {
               var eHeight = parseInt($(element).find(':first-child').css('max-height'));
               return scope.folder.children.length * eHeight;
           }
       }
   }; 
});