class Hello {
    public fooIncr(): number {
        return this.foo() + this.fooHelper();
    }
    public foo(): number {
        return 43110;
    }
    private fooHelper(): number {
        return 10;
    }
}

class HelloDerived extends Hello {
    public foo(): number {
        return 90;
    }
}

function main(): [number] {
    var elements: [number];
    var hello = new HelloDerived();
    var hello2: Hello;
    hello2 = hello;
    var nr: number = hello2.fooIncr();
    elements.push(nr);
    elements.push(new Hello().fooIncr());
    return elements;
}

this.Hello = Hello;
this.main = main;