ngApp.factory('$master', ['$rootScope', '$location', '$window',
    function($rootScope, $location, $window) {
        var pageView = undefined;
        var pages = undefined;
        var container = undefined;
        var loadedNum = 0;
        var index;
        var focusChangedCallback;
        
        $rootScope.$on('$locationChangeStart', function(){
            index = Number(($location.path() || "/0").substr(1));
            if (focusChangedCallback != null) {
                focusChangedCallback(index);
            }
        });
        
        return {
            focus: function(pageIndex) {
                $location.path(pageIndex);
            },
            isFocused: function(pageIndex) {
                if (platform == 'desktop') {
                    return true;
                } else {
                    return index == pageIndex;
                }
            },
            onFocusChanged: function(callback) {
                focusChangedCallback = callback;
                focusChangedCallback(index);
            }
        };
    }
]);
