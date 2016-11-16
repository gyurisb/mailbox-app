ngApp.directive('folder', ['$mailbox', '$app', function($mailbox, $app){
   return {
       restrict: 'E',
       scope: {
        folder: '=model',
        selected: '=',
        states: "=?",
       },
       templateUrl: 'partials/folder.html',
       link: function(scope, element) {
           scope.close = function($event) {
               $event.stopPropagation();
               scope.state.isClosed = true;
           };
           scope.open = function($event) {
               $event.stopPropagation();
               scope.state.isClosed = false;
           };
           scope.hasChildren = function() {
               return scope.folder.children !== undefined && scope.folder.children.length > 0;
           };
           scope.getHeight = function() {
               var eHeight = parseInt($(element).find(':first-child').css('max-height'));
               return scope.folder.children.length * eHeight;
           }
           scope.selectFolder = function() {
                scope.selected.id = scope.folder.id;
                $app.focusFolder(scope.folder);
           }
           scope.drop = function(dragged) {
                if (dragged.email != null) {
                    $mailbox.moveEmail(dragged.email.id, scope.folder.id).success(function(){
                        $app.modifyEmail(dragged.email.id);
                    });
                } else if (dragged.folder != null) {
                    $mailbox.moveFolder(dragged.folder.id, scope.folder.id);
                }
           }
           scope.saveRename = function() {
               var rename = scope.state.rename;
               if (scope.state.rename.value && scope.state.rename.value.indexOf(scope.folder.delimiter) == -1) {
                    if (scope.state.rename.value != scope.folder.name) {
                        $mailbox.renameFolder(scope.folder.id, scope.state.rename.value).success(function(){
                            scope.folder.name = scope.state.rename.value;
                            scope.state.rename = null;
                        }).error(function(err){
                            scope.state.rename = null;
                            alert(JSON.stringify(err));
                        });
                    }
               } else {
                    alert("Empty names and the following characters are not allowed: " + scope.folder.delimiter);
                    scope.state.rename = null;
               }
           }
           scope.state = scope.states[scope.folder.id] = scope.states[scope.folder.id] || {};
           scope.$watch('folder.id', function(){
                scope.state = scope.states[scope.folder.id] = scope.states[scope.folder.id] || {};
           });
           scope.contextMenu = [
               {
                   label: "Rename folder",
                   click: function() {
                       scope.state.rename = { value: scope.folder.name };
                   }
               },
               {
                   label: "Delete folder",
                   click: function() {
                        //TODO megerősítés kérés
                        if (!scope.hasChildren()) {
                            $mailbox.deleteFolder(scope.folder.id);
                        } else {
                            alert("The selected folder has inferiors.");
                        }
                   }
               }
           ];
       }
   }; 
}]);