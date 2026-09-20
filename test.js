const b = btoa(String.fromCharCode.apply(null, new Uint8Array([1, 2, 3])));
console.log(b);
