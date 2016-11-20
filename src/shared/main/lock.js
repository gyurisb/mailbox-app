function LockObject() {
    var lockObject;
    var isLocked = false;
    var lockMonitor = [];
    return lockObject = {
        startLock: function(success) {
            if (isLocked) {
                lockMonitor.push(success);
            } else {
                isLocked = true;
                success();
            }
        },
        endLock: function() {
            if (lockMonitor.length) {
                lockMonitor.splice(0, 1)[0]();
            } else {
                isLocked = false;
            }
        },
        createLockedObject: function(obj) {
            var newObj = {};
            Object.keys(obj).forEach(function(key){
                if (typeof obj[key] == 'function' && obj[key].length >= 2) {
                    var fun = obj[key];
                    newObj[key] = function() {
                        var args = Array.prototype.slice.call(arguments);
                        lockObject.startLock(function(){
                            fun.apply(this, args.slice(0, -2).concat([function(){
                                lockObject.endLock();
                                args.slice(-2)[0].apply(obj, arguments);
                            }, function(){
                                lockObject.endLock();
                                args.slice(-1)[0].apply(obj, arguments);
                            }]));
                        });
                    }
                } else {
                    newObj[key] = obj[key];
                }
            });
            return newObj;
        }
    };
}

module.exports = LockObject;