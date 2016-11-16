ngApp.controller('FoldersController', ['$scope', '$mailbox', '$app', '$master', function($scope, $mailbox, $app, $master) {

    $scope.selected = { id: null };
    $scope.new = null;
    $scope.folderStates = {};

    $scope.accountMenu = [
        {
            label: "Create a new folder",
            click: function() {
                $scope.new = { name: "" };
            }
        },
        {
            label: "Logout",
            click: function(){}
        }
    ];
    
    function foldersLoaded(root) {
        if (!angular.equals(root, $scope.root)) {
            $scope.root = root;
            if ($scope.selected.id == null && root && root.children.length) {
                $scope.selected.id = root.children[0].id;
            }
        }
    }
    
    $app.onRestore(function(){
        $mailbox.getFolders().success(foldersLoaded);
    });
    
    $mailbox.onMailboxUpdate(function(){
        $mailbox.getFolders().success(foldersLoaded);
    });

    $scope.dropFolderOnRoot = function(dragged) {
        if (dragged.folder != null) {
            $mailbox.moveFolder(dragged.folder.id, null);
        }
    }

    $scope.newFolder = function() {
        if ($scope.new.name && $scope.new.name.indexOf($scope.root.children[0].delimiter) == -1) {
            $mailbox.createFolder(null, $scope.new.name).success(function(){
                $scope.new = null;
            }).error(function(err){
                $scope.new = null;
                alert(JSON.stringify(err));
            });
        } else {
            $scope.new = null;
            alert("Empty names and the following characters are not allowed: " + $scope.root.children[0].delimiter);
        }
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
