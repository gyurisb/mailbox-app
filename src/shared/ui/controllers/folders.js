app.controller('FoldersController', ['$scope', '$email', '$app', '$master', function($scope, $email, $app, $master) {

    $scope.folders = [];
    $scope.selectedFolder = null;
    $app.onLogin(function(){
        $email.getFolders().success(function(root) {
            orderTopMailboxes(root);
            $scope.root = root;
            $scope.selectedFolder = root.children[0];
            $master.focus(1);
        });
    });
    
    $scope.folderClicked = function(folder) {
        $scope.selectedFolder = folder;
        $app.focusFolder(folder);
    }
    
    $scope.times = function(size) {
        return new Array(size);
    }
    
    function orderTopMailboxes(root) {
        var unorderable = root.children.slice(0, 5);
        var orderable = root.children.slice(5);
        orderable.sort(function(folder1, folder2){
            return folder1.name.localeCompare(folder2.name); 
        });
        root.children = unorderable.concat(orderable);
        root.children.forEach(function(child){
            orderMailboxes(child);
        });
    }
    function orderMailboxes(folder) {
        if (folder.children !== undefined) {
            folder.children.sort(function(folder1, folder2){
                return folder1.name.localeCompare(folder2.name); 
            });
            folder.children.forEach(function(child){
                orderMailboxes(child);
            });
        }
    }
}]);

app.directive('mailboxFolder', function(){
   return {
       restrict: 'E',
       scope: {
        folder: '=model',
        selectedFolder: '=selectedFolder',
        folderClicked: '=folderClicked'
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