var ngApp = angular.module('emailApp', ['ngAnimate', 'ngMaterial', 'ui.tinymce']);
var loggedIn = false;

ngApp.config(function($mdThemingProvider, $mdIconProvider) {
    // Configure a dark theme with primary foreground yellow
    $mdThemingProvider.theme('docs-dark', 'default')
        .primaryPalette('yellow')
        .dark();
    //Configure icons
    $mdIconProvider
       .defaultFontSet('fa fa-lg');
});

ngApp.directive('statusBar', function(){
   return {
       restrict: 'EA',
       templateUrl: 'partials/statusBar.html',
   }; 
});

ngApp.filter('bytes', function() {
	return function(bytes, precision) {
		if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
		if (typeof precision === 'undefined') precision = 1;
		var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
			number = Math.floor(Math.log(bytes) / Math.log(1024));
		return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
	}
});

ngApp.directive('ngDrag', function(){
    return {
        restrict: "A",
        scope: {
            ngDrag: '=',
            // ngDragStart: '&',
            // ngDragEnd: '&',
        },
        link: function (scope, element, attr){
            if (scope.ngDrag) {
                element.attr('draggable', 'true');
                element.off('dragstart');
                element.on('dragstart', function(ev){
                    ev.dataTransfer.setData('text', JSON.stringify(scope.ngDrag));
                });
            }
        }
    };
});

ngApp.directive('ngDrop', function(){
    return {
        restrict: "A",
        scope: {
            ngDrop: '&',
        },
        link: function (scope, element, attr){
            element.off('drop');
            element.on('drop', function(ev){
                ev.preventDefault();
                var data = JSON.parse(ev.dataTransfer.getData("text"));
                scope.ngDrop({ '$data': data });
                scope.$apply();
            });
            element.off('dragover');
            element.on('dragover', function(ev){
                ev.preventDefault();
            })
        }
    };
});

ngApp.directive('autoFocus', function(){
    return {
        restrict: 'A',
        link: function(scope, element) {
            element.focus();
        }
    }
})

ngApp.directive('ngContentEditable', function(){
    return {
        restrict: 'A',
        scope: {
            ngModel: '=',
        },
        require: 'ngModel',
        link: function(scope, element, attrs, ngModelCtrl) {
            element.attr('contenteditable', true)
            ngModelCtrl.$formatters.push(function(value){
                element.html(value);
            });
            element.on('blur keyup paste copy cut delete mouseup', function() {
                scope.$apply(function(){
                    var value = element.html();
                    ngModelCtrl.$modelValue = value;
                    scope.ngModel = value;
                })
            })
        }
    }
});

ngApp.directive('actionButtons', ['$timeout', function($timeout){
    return {
        restrict: 'A',
        link: function(scope, element) {
            element.attr('tabindex', 1);
            element.addClass('action-buttons');
            element.on('click', function(){
                element.toggleClass('action-buttons-active')
            })
            element.on('blur', function(){
                $timeout(function(){
                    element.removeClass('action-buttons-active')
                }, 100);
            })
        }
    }
}])