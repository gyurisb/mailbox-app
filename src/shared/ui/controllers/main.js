ngApp.controller('MainController', ['$scope', '$app', '$master', '$mailbox', function($scope, $app, $master, $mailbox) {
    
    mainScope = $scope;
    $master.setScope($scope);
    $scope.page = 0;
    $scope.title = "Mailbox";
    $scope.folderInProgress = {};

    $mailbox.onAccountUpdate().success(function(evt){
        if (evt.type == "account") {
            if (evt.email) {
                $scope.loggedIn = true;
                $scope.emailAddress = evt.email;
                $app.restore();
            } else {
                setPhase("noaccount");
                $app.requestLogin();
            }
        } else if (evt.type == "progress") {
            setPhase(evt.phase);
            $scope.progress = evt.progress;
            if (evt.phase == "done") {
                $scope.syncDate = evt.syncDate;
            } else if (evt.phase == "error") {
                $scope.errorMessage = JSON.stringify(evt.error);
            }
        } else if (evt.type == "folderProgress") {
            $scope.folderInProgress[evt.folder] = evt.progress;
        }
    });

    $scope.loggedIn = false;
    $mailbox.restore();
    
    $scope.newEmail = function() {
        $app.newEmail();
    };
    
    $scope.editAccount = function() {
    }
    
    $scope.logout = function() {
    }

    $scope.back = function() {
        window.history.back();
    }

    function setPhase(phase) {
        $scope.phase = phase;
        $scope.phaseClass = {};
        $scope.phaseClass['phase-' + phase] = true;
    }
}]);