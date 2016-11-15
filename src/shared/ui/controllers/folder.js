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
                scope.selected.path = scope.folder.path;
                $app.focusFolder(scope.folder.path);
           }
           scope.drop = function(source) {
                if (source.email != null && source.path != null) {
                    if (source.path != scope.folder.path) {
                        $mailbox.moveEmail(source.path, source.email.uid, scope.folder.path);
                        $app.modifyEmail(source.path, source.email.uid);
                    }
                } else if (source.folder != null) {
                    var sourceParentPath = source.folder.path.split(source.folder.delimiter).slice(0, -1).join(source.folder.delimiter);
                    if (scope.folder.path.indexOf(source.folder.path) != 0 && sourceParentPath != scope.folder.path) {
                        $mailbox.moveFolder(source.folder, scope.folder);
                    }
                }
           }
           scope.saveRename = function() {
               var rename = scope.state.rename;
               if (scope.state.rename.value && scope.state.rename.value.indexOf(scope.folder.delimiter) == -1) {
                    if (scope.state.rename.value != scope.folder.name) {
                        $mailbox.renameFolder(scope.folder, scope.state.rename.value).success(function(){
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
           scope.state = scope.states[scope.folder.path] = scope.states[scope.folder.path] || {};
           scope.$watch('folder.path', function(oldValue, newValue){
               if (newValue != oldValue) {
                    console.log("value changed: " + oldValue + " " + newValue);
                    delete scope.states[oldValue];
                    scope.state = scope.states[newValue] = scope.states[newValue] || {};
               }
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
                            $mailbox.deleteFolder(scope.folder);
                        } else {
                            alert("The selected folder has inferiors.");
                        }
                   }
               }
           ];
       }
   }; 
}]);