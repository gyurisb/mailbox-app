app.controller('FoldersController', ['$scope', '$email', '$app', '$master', function($scope, $email, $app, $master) {

    $scope.folders = [];
    $scope.selectedFolder = null;
    $app.onLogin(function(){
        $email.getFolders().success(function(foldersObj) {
            $scope.folders = foldersObj.children;
            $master.focus(1);
        });
    });
    
    $scope.folderClicked = function(folder) {
        $scope.selectedFolder = folder;
        $app.focusFolder(folder);
    }
}]);