/*
 * Cryptographic Functions Hooking Script
 * Hooks and logs cryptographic operations including encryption,
 * decryption, hashing, and key management
 *
 * This script is useful for malware analysis to understand
 * cryptographic operations performed by the target application.
 */

console.log("[*] Cryptographic Functions Hooking Script Started");

// Configuration
var config = {
    logEncryption: true,
    logDecryption: true,
    logHashing: true,
    logKeyGeneration: true,
    logKeys: false, // Set to true to log actual keys (security warning!)
    maxDataLength: 256,
    excludeCommonKeys: true
};

// Utility functions
function bytesToHex(bytes) {
    if (!bytes) return "";
    var hex = "";
    for (var i = 0; i < Math.min(bytes.length, config.maxDataLength); i++) {
        var b = bytes[i] & 0xff;
        hex += ((b < 16) ? "0" : "") + b.toString(16);
    }
    if (bytes.length > config.maxDataLength) {
        hex += "...";
    }
    return hex;
}

function bytesToBase64(bytes) {
    if (!bytes) return "";
    return Java.use("android.util.Base64").encodeToString(bytes, 0);
}

function isCommonKey(keyData) {
    if (!config.excludeCommonKeys) return false;

    var keyHex = bytesToHex(keyData).toLowerCase();
    var commonKeys = [
        "000102030405060708090a0b0c0d0e0f", // AES-128 zero key
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", // AES-256 zero key
        "1234567890123456", // Common test key
        "thisisapassword1234567890123456", // Another common test key
        "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f", // All bytes 0x00-0x1f
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" // All 0xff
    ];

    return commonKeys.some(function(ck) {
        return keyHex.includes(ck) || keyHex.startsWith(ck);
    });
}

function shouldLogKey(keyData) {
    if (!config.logKeys) return false;
    if (config.excludeCommonKeys && isCommonKey(keyData)) return false;
    return true;
}

function logCryptoOperation(operation, algorithm, data, key, iv, result) {
    console.log("[CRYPTO] " + operation + " (" + algorithm + ")");

    if (data && data.length > 0) {
        console.log("    Input (" + data.length + " bytes): " + bytesToHex(data));
    }

    if (key && shouldLogKey(key)) {
        console.log("    Key (" + key.length + " bytes): " + bytesToHex(key));
    } else if (key) {
        console.log("    Key: " + key.length + " bytes [hidden]");
    }

    if (iv) {
        console.log("    IV (" + iv.length + " bytes): " + bytesToHex(iv));
    }

    if (result && result.length > 0) {
        console.log("    Output (" + result.length + " bytes): " + bytesToHex(result));
    }
}

Java.perform(function() {
    console.log("[+] Hooking Java cryptographic functions");

    // Hook Cipher class
    try {
        var Cipher = Java.use("javax.crypto.Cipher");

        Cipher.getInstance.overload('java.lang.String').implementation = function(transformation) {
            console.log("[CRYPTO] Cipher.getInstance: " + transformation);
            return this.getInstance(transformation);
        };

        Cipher.init.overload('int', 'java.security.Key').implementation = function(opmode, key) {
            var operation = (opmode === 1) ? "ENCRYPT" : (opmode === 2) ? "DECRYPT" : "OTHER";
            var algorithm = this.getAlgorithm();
            console.log("[CRYPTO] Cipher.init: " + operation + " with " + algorithm);

            if (key && key.getEncoded) {
                var keyData = key.getEncoded();
                if (shouldLogKey(keyData)) {
                    console.log("    Key: " + bytesToHex(keyData));
                }
            }

            return this.init(opmode, key);
        };

        Cipher.init.overload('int', 'java.security.Key', 'java.security.spec.AlgorithmParameterSpec').implementation = function(opmode, key, params) {
            var operation = (opmode === 1) ? "ENCRYPT" : (opmode === 2) ? "DECRYPT" : "OTHER";
            var algorithm = this.getAlgorithm();
            console.log("[CRYPTO] Cipher.init: " + operation + " with " + algorithm + " and params");

            if (key && key.getEncoded) {
                var keyData = key.getEncoded();
                if (shouldLogKey(keyData)) {
                    console.log("    Key: " + bytesToHex(keyData));
                }
            }

            return this.init(opmode, key, params);
        };

        Cipher.doFinal.overload('[B').implementation = function(input) {
            var result = this.doFinal(input);
            var algorithm = this.getAlgorithm();
            var operation = this.getOutputSize(0) > 0 ? "ENCRYPT" : "DECRYPT";

            logCryptoOperation(operation, algorithm, input, null, null, result);
            return result;
        };

        Cipher.doFinal.overload('[B', 'int', 'int', '[B', 'int').implementation = function(input, inputOffset, inputLen, output, outputOffset) {
            var result = this.doFinal(input, inputOffset, inputLen, output, outputOffset);
            var algorithm = this.getAlgorithm();

            var inputData = null;
            if (input && inputLen > 0) {
                inputData = Java.array('byte', input.slice(inputOffset, inputOffset + inputLen));
            }

            var outputData = null;
            if (output && outputOffset >= 0) {
                outputData = Java.array('byte', output.slice(outputOffset, outputOffset + result));
            }

            var operation = result > 0 ? "ENCRYPT" : "DECRYPT";
            logCryptoOperation(operation, algorithm, inputData, null, null, outputData);

            return result;
        };

    } catch (e) {
        console.log("[-] Could not hook Cipher: " + e);
    }

    // Hook MessageDigest
    try {
        var MessageDigest = Java.use("java.security.MessageDigest");

        MessageDigest.getInstance.overload('java.lang.String').implementation = function(algorithm) {
            console.log("[CRYPTO] MessageDigest.getInstance: " + algorithm);
            return this.getInstance(algorithm);
        };

        MessageDigest.digest.overload('[B').implementation = function(input) {
            var result = this.digest(input);
            var algorithm = this.getAlgorithm();

            console.log("[CRYPTO] HASH (" + algorithm + ")");
            console.log("    Input (" + input.length + " bytes): " + bytesToHex(input));
            console.log("    Hash (" + result.length + " bytes): " + bytesToHex(result));

            return result;
        };

        MessageDigest.digest.overload().implementation = function() {
            var result = this.digest();
            var algorithm = this.getAlgorithm();

            console.log("[CRYPTO] HASH (" + algorithm + ")");
            console.log("    Hash (" + result.length + " bytes): " + bytesToHex(result));

            return result;
        };

    } catch (e) {
        console.log("[-] Could not hook MessageDigest: " + e);
    }

    // Hook KeyGenerator
    try {
        var KeyGenerator = Java.use("javax.crypto.KeyGenerator");

        KeyGenerator.getInstance.overload('java.lang.String').implementation = function(algorithm) {
            console.log("[CRYPTO] KeyGenerator.getInstance: " + algorithm);
            return this.getInstance(algorithm);
        };

        KeyGenerator.generateKey.implementation = function() {
            var key = this.generateKey();
            var algorithm = this.getAlgorithm();

            console.log("[CRYPTO] KEYGEN (" + algorithm + ")");
            if (key && key.getEncoded) {
                var keyData = key.getEncoded();
                if (shouldLogKey(keyData)) {
                    console.log("    Generated Key (" + keyData.length + " bytes): " + bytesToHex(keyData));
                } else {
                    console.log("    Generated Key: " + keyData.length + " bytes [hidden]");
                }
            }

            return key;
        };

    } catch (e) {
        console.log("[-] Could not hook KeyGenerator: " + e);
    }

    // Hook SecretKeySpec
    try {
        var SecretKeySpec = Java.use("javax.crypto.spec.SecretKeySpec");

        SecretKeySpec.$init.overload('[B', 'java.lang.String').implementation = function(key, algorithm) {
            console.log("[CRYPTO] SecretKeySpec created: " + algorithm);

            if (shouldLogKey(key)) {
                console.log("    Key (" + key.length + " bytes): " + bytesToHex(key));
            } else {
                console.log("    Key: " + key.length + " bytes [hidden]");
            }

            return this.$init(key, algorithm);
        };

    } catch (e) {
        console.log("[-] Could not hook SecretKeySpec: " + e);
    }

    // Hook IvParameterSpec
    try {
        var IvParameterSpec = Java.use("javax.crypto.spec.IvParameterSpec");

        IvParameterSpec.$init.overload('[B').implementation = function(iv) {
            console.log("[CRYPTO] IvParameterSpec created");
            console.log("    IV (" + iv.length + " bytes): " + bytesToHex(iv));

            return this.$init(iv);
        };

    } catch (e) {
        console.log("[-] Could not hook IvParameterSpec: " + e);
    }

    // Hook Android-specific crypto
    try {
        // Hook Android Keystore
        var KeyStore = Java.use("java.security.KeyStore");

        KeyStore.getInstance.overload('java.lang.String').implementation = function(type) {
            console.log("[CRYPTO] KeyStore.getInstance: " + type);
            return this.getInstance(type);
        };

        KeyStore.load.overload('java.security.KeyStore$LoadStoreParameter').implementation = function(param) {
            console.log("[CRYPTO] KeyStore.load with parameter");
            return this.load(param);
        };

        KeyStore.getKey.overload('java.lang.String', '[C').implementation = function(alias, password) {
            console.log("[CRYPTO] KeyStore.getKey: " + alias);
            var key = this.getKey(alias, password);

            if (key && key.getEncoded) {
                var keyData = key.getEncoded();
                console.log("    Retrieved Key (" + keyData.length + " bytes) [hidden]");
            }

            return key;
        };

    } catch (e) {
        console.log("[-] Could not hook Android KeyStore: " + e);
    }

    // Hook Base64 encoding/decoding
    try {
        var Base64 = Java.use("android.util.Base64");

        Base64.decode.overload('java.lang.String', 'int').implementation = function(str, flags) {
            console.log("[CRYPTO] Base64.decode: " + str.substring(0, Math.min(50, str.length)) + "...");
            return this.decode(str, flags);
        };

        Base64.encode.overload('[B', 'int').implementation = function(input, flags) {
            var result = this.encode(input, flags);
            console.log("[CRYPTO] Base64.encode (" + input.length + " bytes)");
            console.log("    Result: " + result.substring(0, Math.min(100, result.length)) + "...");
            return result;
        };

    } catch (e) {
        console.log("[-] Could not hook Base64: " + e);
    }
});

// Hook native crypto functions
var cryptoFuncs = [
    "EVP_EncryptInit_ex",
    "EVP_EncryptUpdate",
    "EVP_EncryptFinal_ex",
    "EVP_DecryptInit_ex",
    "EVP_DecryptUpdate",
    "EVP_DecryptFinal_ex",
    "EVP_DigestInit_ex",
    "EVP_DigestUpdate",
    "EVP_DigestFinal_ex",
    "RAND_bytes",
    "CNG_Encrypt",
    "CNG_Decrypt"
];

cryptoFuncs.forEach(function(funcName) {
    try {
        var funcPtr = Module.findExportByName(null, funcName);
        if (funcPtr) {
            Interceptor.attach(funcPtr, {
                onEnter: function(args) {
                    this.funcName = funcName;
                    this.timestamp = new Date().toISOString();
                },
                onLeave: function(retval) {
                    console.log("[CRYPTO] Native: " + this.funcName);
                    console.log("    Timestamp: " + this.timestamp);
                    console.log("    Result: " + retval);
                }
            });
        }
    } catch (e) {
        // Ignore if function not found
    }
});

// Export crypto monitoring functions
global.CryptoMonitor = {
    setConfig: function(newConfig) {
        Object.assign(config, newConfig);
        console.log("[*] Crypto monitor configuration updated");
    },

    logCustomCrypto: function(operation, algorithm, data, key, result) {
        logCryptoOperation(operation, algorithm, data, key, null, result);
    },

    analyzeKey: function(keyData) {
        if (!keyData) return null;

        var analysis = {
            length: keyData.length,
            entropy: 0,
            pattern: "unknown",
            isCommon: isCommonKey(keyData)
        };

        // Simple entropy calculation
        var freq = {};
        for (var i = 0; i < keyData.length; i++) {
            var byte = keyData[i] & 0xff;
            freq[byte] = (freq[byte] || 0) + 1;
        }

        for (var byte in freq) {
            var p = freq[byte] / keyData.length;
            analysis.entropy -= p * Math.log2(p);
        }

        // Pattern detection
        if (analysis.entropy < 2) {
            analysis.pattern = "low_entropy";
        } else if (analysis.entropy > 7.5) {
            analysis.pattern = "high_entropy";
        } else {
            analysis.pattern = "normal";
        }

        return analysis;
    }
};

console.log("[*] Cryptographic Functions Hooking Script Loaded Successfully");
console.log("[*] Monitoring encryption, decryption, hashing, and key operations");

// Display configuration
console.log("[CONFIG] Log encryption: " + config.logEncryption);
console.log("[CONFIG] Log decryption: " + config.logDecryption);
console.log("[CONFIG] Log hashing: " + config.logHashing);
console.log("[CONFIG] Log keys: " + config.logKeys + " (WARNING: This may expose sensitive data)");
console.log("[CONFIG] Exclude common keys: " + config.excludeCommonKeys);