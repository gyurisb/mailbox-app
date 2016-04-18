var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var Hello = (function () {
    function Hello() {
    }
    Hello.prototype.fooIncr = function () {
        return this.foo() + this.fooHelper();
    };
    Hello.prototype.foo = function () {
        return 43110;
    };
    Hello.prototype.fooHelper = function () {
        return 10;
    };
    return Hello;
})();

var HelloDerived = (function (_super) {
    __extends(HelloDerived, _super);
    function HelloDerived() {
        _super.apply(this, arguments);
    }
    HelloDerived.prototype.foo = function () {
        return 90;
    };
    return HelloDerived;
})(Hello);

function main() {
    //var str: string;
    //var elements: [number];
    //elements.push(hello.fooIncr(), )
    var hello = new HelloDerived();
    var hello2;
    hello2 = hello;
    var nr = hello2.fooIncr();
    return nr;
}

this.Hello = Hello;
this.main = main;
