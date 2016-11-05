ngApp.controller('FoldersController', ['$scope', '$mailbox', '$app', '$master', function($scope, $mailbox, $app, $master) {

    $scope.selectedFolder = null;
    
    function foldersLoaded(root) {
        if (!angular.equals(root, $scope.root)) {
            $scope.root = root;
            if ($scope.selectedFolder == null && root && root.children.length)
                $scope.selectedFolder = root.children[0].path;
        }
    }
    
    $app.onRestore(function(){
        $mailbox.getFolders().success(foldersLoaded);
    });
    
    $mailbox.onMailboxUpdate().success(function(){
        $mailbox.getFolders().success(foldersLoaded);
    });

    $scope.folderClicked = function(folder) {
        $scope.selectedFolder = folder.path;
        $app.focusFolder(folder);
    }
    
    $scope.times = function(size) {
        return new Array(size);
    }    
}]);

ngApp.directive('folders', function(){
   return {
       restrict: 'EA',
       templateUrl: 'partials/folders.html',
   }; 
});
