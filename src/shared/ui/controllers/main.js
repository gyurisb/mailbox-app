ngApp.controller('MainController', ['$scope', '$app', '$master', '$mailbox', function($scope, $app, $master, $mailbox) {
    
    mainScope = $scope;
    $master.setScope($scope);
    $scope.titles = {};
    $scope.loggedIn = false;
    $scope.folderInProgress = {};

    $mailbox.onAccountUpdate(function(evt){
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
            if (evt.phase == "commands") {
                $scope.command = evt.command;
            } else if (evt.phase == "done") {
                $scope.syncDate = evt.syncDate;
            } else if (evt.phase == "error") {
                $scope.errorMessage = JSON.stringify(evt.error);
                $scope.syncDate = evt.syncDate;
            }
        } else if (evt.type == "folderProgress") {
            $scope.folderInProgress[evt.folder] = evt.progress;
        } else if (evt.type == "rejectedAddresses") {
            alert("Sending email failed. The following recepients were rejected: " + evt.failedRecipients.join("\n"));
        }
    });

    $mailbox.restore();

    $scope.back = function() {
        window.history.back();
    }

    function setPhase(phase) {
        $scope.phase = phase;
        $scope.phaseClass = {};
        $scope.phaseClass['phase-' + phase] = true;
    }
}]);