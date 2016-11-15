ngApp.controller('FoldersController', ['$scope', '$mailbox', '$app', '$master', function($scope, $mailbox, $app, $master) {

    $scope.selected = { path: null };
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
    
    $mailbox.onFolderPathUpdate(function(evt){
        if (evt.oldPath == $scope.selected.path || $scope.selected.path.indexOf(evt.oldPath + evt.delimiter) == 0) {
            $scope.selected.path = evt.newPath ? $scope.selected.path.replace(evt.oldPath, evt.newPath) : null;
        }
        Object.keys($scope.folderStates).forEach(function(path){
            if (evt.oldPath == path || path.indexOf(evt.oldPath + evt.delimiter) == 0) {
                if (evt.newPath) {
                    $scope.folderStates[path.replace(evt.oldPath, evt.newPath)] = $scope.folderStates[path];
                }
                delete $scope.folderStates[path];
            }
        });
    });
    
    function foldersLoaded(root) {
        if (!angular.equals(root, $scope.root)) {
            $scope.root = root;
            if ($scope.selected.path == null && root && root.children.length)
                $scope.selected.path = root.children[0].path;
        }
    }
    
    $app.onRestore(function(){
        $mailbox.getFolders().success(foldersLoaded);
    });
    
    $mailbox.onMailboxUpdate(function(){
        $mailbox.getFolders().success(foldersLoaded);
    });

    $scope.dropFolderOnRoot = function(source) {
        if (source.folder != null) {
            if (source.folder.path.indexOf(source.folder.delimiter) >= 0) {
                $mailbox.moveFolder(source.folder, null);
            }
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
