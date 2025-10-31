function setup(resource) {
    resource._idleTimeout = 42;
    resource.timeout = setTimeout(() => { }, 42);
}

setup({});
