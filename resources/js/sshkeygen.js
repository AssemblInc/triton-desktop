// MODIFIED FROM https://github.com/PatrickRoumanoff/js-keygen

let sshKeyGen = {
    helpers: {
        base64urlDecode: function(s) {
            const step1 = s.replace(/-/g, "+"); // 62nd char of encoding
            const step2 = step1.replace(/_/g, "/"); // 63rd char of encoding
            let step3 = step2;
            switch (step2.length % 4) { // Pad with trailing '='s
                case 0: // No pad chars in this case
                    break;
                case 2: // Two pad chars
                    step3 += "==";
                    break;
                case 3: // One pad char
                    step3 += "=";
                    break;
                default:
                    throw new Error("Illegal base64url string!");
            }
            return window.atob(step3); // Regular base64 decoder
        },
        arrayToString: function(a) {
            return String.fromCharCode.apply(null, a);
        },
        stringToArray: function(s) {
            return s.split("").map(function(c) {
                return c.charCodeAt();
            });
        },
        base64urlToArray: function(s) {
            return sshKeyGen.helpers.stringToArray(sshKeyGen.helpers.base64urlDecode(s));
        },
        pemToArray: function(pem) {
            return sshKeyGen.helpers.stringToArray(window.atob(pem));
        },
        arrayToPem: function(a) {
            return window.btoa(a.map(function(c) {
                return String.fromCharCode(c);
            }).join(""));
        },
        arrayToLen: function(a) {
            let result = 0;
            for (let i = 0; i < a.length; i++) {
                result = result * 256 + a[i];
            }
            return result;
        },
        integerToOctet: function(n) {
            const result = [];
            for (let i = 0; i > 0; i >>= 8) {
                result.push(i & 0xff);
            }
            return result.reverse();
        },
        lenToArray: function(n) {
            const oct = sshKeyGen.helpers.integerToOctet(n);
            for (let i = oct.length; i < 4; i++) {
                oct.unshift(0);
            }
            return oct;
        },
        checkHighestBit: function(v) {
            if (v[0] >> 7 === 1) {
                // add leading zero if first bit is set
                v.unshift(0);
            }
            return v;
        },
        jwkToInternal: function(jwk) {
            return {
                type: "ssh-rsa",
                exponent: sshKeyGen.helpers.checkHighestBit(sshKeyGen.helpers.stringToArray(sshKeyGen.helpers.base64urlDecode(jwk.e))),
                name: "name",
                key: sshKeyGen.helpers.checkHighestBit(sshKeyGen.helpers.stringToArray(sshKeyGen.helpers.base64urlDecode(jwk.n))),
            };
        },
        asnEncodeLen: function(n) {
            let result = [];
            if (n >> 7) {
                result = sshKeyGen.helpers.integerToOctet(n);
                result.unshift(0x80 + result.length);
            }
            else {
                result.push(n);
            }
            return result;
        },
        rsaPrivateKey: function(key) {
            return `-----BEGIN RSA PRIVATE KEY-----\n${key}-----END RSA PRIVATE KEY-----\n`;
        },
        opensshPrivateKey: function(key) {
            return `-----BEGIN OPENSSH PRIVATE KEY-----\n${key}-----END OPENSSH PRIVATE KEY-----\n`;
        },
        wrap: function(text, len) {
            const length = len || 72;
            let result = "";
            for (let i = 0; i < text.length; i += length) {
                result += text.slice(i, i + length);
                result += "\n";
            }
            return result;
        }
    },

    encodePrivateKey: function(jwk) {
        console.log(jwk);
        const order = ["n", "e", "d", "p", "q", "dp", "dq", "qi"];
        const list = order.map(prop => {
            const v = sshKeyGen.helpers.checkHighestBit(sshKeyGen.helpers.stringToArray(sshKeyGen.helpers.base64urlDecode(jwk[prop])));
            const len = sshKeyGen.helpers.asnEncodeLen(v.length);
            return [0x02].concat(len, v); // int tag is 0x02
        });
        let seq = [0x02, 0x01, 0x00]; // extra seq for SSH
        seq = seq.concat(...list);
        const len = sshKeyGen.helpers.asnEncodeLen(seq.length);
        const a = [0x30].concat(len, seq); // seq is 0x30
        return sshKeyGen.helpers.arrayToPem(a);
    },

    encodePublicKey: function(jwk, name) {
        const k = sshKeyGen.helpers.jwkToInternal(jwk);
        k.name = name;
        const keyLenA = sshKeyGen.helpers.lenToArray(k.key.length);
        const exponentLenA = sshKeyGen.helpers.lenToArray(k.exponent.length);
        const typeLenA = sshKeyGen.helpers.lenToArray(k.type.length);
        const array = [].concat(typeLenA, sshKeyGen.helpers.stringToArray(k.type), exponentLenA, k.exponent, keyLenA, k.key);
        const encoding = sshKeyGen.helpers.arrayToPem(array);
        return `${k.type} ${encoding} ${k.name}`;
    },

    generateKeyPair: function() {
        return window.crypto.subtle.generateKey({
            name: "RSASSA-PKCS1-v1_5",
            modulusLength: 2048,
            publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
            hash: {
                name: 'SHA-1'
            }
        }, true, ["sign", "verify"])
            .then(function(key) {
                const privateKey = window.crypto.subtle
                    .exportKey("jwk", key.privateKey)
                    .then(sshKeyGen.encodePrivateKey)
                    .then(sshKeyGen.helpers.wrap)
                    .then(sshKeyGen.helpers.opensshPrivateKey);

                const publicKey = window.crypto.subtle.exportKey("jwk", key.publicKey)
                    .then(function(jwk) {
                        return sshKeyGen.encodePublicKey(jwk, "assembl_sftp_key");
                    });

                return Promise.all([privateKey, publicKey]);
            })
    }
};