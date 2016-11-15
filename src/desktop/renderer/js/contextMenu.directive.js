ngApp.directive('contextMenu', ['$app', '$rootScope', function($app, $rootScope){

    var nextId = 0;
    var handlers = {};
    ipcRenderer.on('contextMenuClick', function(event, args){
        handlers[args.id][args.menuId]();
        $rootScope.$apply();
    });

    return {
        restrict: 'A',
        scope: {
            contextMenu: '='
        },
        link: function(scope, element) {
            element.off('contextmenu');
            element.on('contextmenu', function(e) {
                if (scope.contextMenu) {
                    e.preventDefault();
                    handlers[scope.id] = {};
                    scope.contextMenu.forEach(function(menu, index){
                        if (menu.click){
                            handlers[scope.id][index] = menu.click;
                        }
                    });
                    ipcRenderer.send('openContextMenu', { id: scope.id, menu: scope.contextMenu });
                }
            });
            if (!scope.id) {
                scope.id = nextId++;
                scope.$on('$destroy', function() {
                    delete handlers[scope.id];
                });
            }
        }
    }; 
}]);