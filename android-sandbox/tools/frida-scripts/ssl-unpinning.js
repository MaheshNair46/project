/*
 * SSL Certificate Unpinning Script for Android
 * Bypasses SSL certificate pinning in Android applications
 *
 * This script hooks common SSL certificate validation methods and
 * forces them to accept any certificate, useful for malware analysis
 * and security research.
 */

console.log("[*] SSL Certificate Unpinning Script Started");

// Hook Java SSL methods
Java.perform(function() {
    console.log("[+] Hooking Java SSL methods");

    try {
        // Hook TrustManager implementations
        var TrustManagerImpl = Java.use("com.android.org.conscrypt.TrustManagerImpl");

        TrustManagerImpl.verifyChain.implementation = function(untrustedChain, trustAnchorChain, host, clientAuth, ocsp, certPin) {
            console.log("[+] Bypassing TrustManagerImpl.verifyChain for: " + host);
            return untrustedChain;
        };

        // Hook X509TrustManager
        var X509TrustManager = Java.use("javax.net.ssl.X509TrustManager");

        X509TrustManager.checkServerTrusted.implementation = function(chain, authType) {
            console.log("[+] Bypassing X509TrustManager.checkServerTrusted");
            return;
        };

        X509TrustManager.checkClientTrusted.implementation = function(chain, authType) {
            console.log("[+] Bypassing X509TrustManager.checkClientTrusted");
            return;
        };

        // Hook HostnameVerifier
        var HostnameVerifier = Java.use("javax.net.ssl.HostnameVerifier");

        HostnameVerifier.verify.implementation = function(hostname, session) {
            console.log("[+] Bypassing HostnameVerifier.verify for: " + hostname);
            return true;
        };

        // Hook Apache HTTP Client
        try {
            var AbstractVerifier = Java.use("org.apache.http.conn.ssl.AbstractVerifier");

            AbstractVerifier.verify.implementation = function(host, ssl) {
                console.log("[+] Bypassing Apache AbstractVerifier.verify for: " + host);
                return;
            };
        } catch (e) {
            console.log("[-] Apache HTTP Client not found: " + e);
        }

        // Hook OkHttp3
        try {
            var CertificatePinner = Java.use("okhttp3.CertificatePinner");

            CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function(hostname, peerCertificates) {
                console.log("[+] Bypassing OkHttp3 CertificatePinner.check for: " + hostname);
                return;
            };

            CertificatePinner.check.overload('java.lang.String', 'java.security.cert.Certificate').implementation = function(hostname, peerCertificate) {
                console.log("[+] Bypassing OkHttp3 CertificatePinner.check (single cert) for: " + hostname);
                return;
            };
        } catch (e) {
            console.log("[-] OkHttp3 not found: " + e);
        }

        // Hook网络安全配置 (Network Security Configuration)
        try {
            var NetworkSecurityPolicy = Java.use("android.security.NetworkSecurityPolicy");

            NetworkSecurityPolicy.getInstance.implementation = function() {
                console.log("[+] Bypassing NetworkSecurityPolicy.getInstance");
                var policy = this.getInstance();
                policy.isCleartextTrafficPermitted.overload().implementation = function() {
                    return true;
                };
                return policy;
            };
        } catch (e) {
            console.log("[-] NetworkSecurityPolicy not found: " + e);
        }

        // Hook CertificateFactory
        try {
            var CertificateFactory = Java.use("java.security.cert.CertificateFactory");

            CertificateFactory.generateCertificate.implementation = function(inStream) {
                console.log("[+] Intercepting CertificateFactory.generateCertificate");
                return this.generateCertificate(inStream);
            };
        } catch (e) {
            console.log("[-] CertificateFactory not found: " + e);
        }

    } catch (e) {
        console.log("[-] Error hooking Java SSL methods: " + e);
    }
});

// Hook native SSL functions
Interceptor.attach(Module.findExportByName("libssl.so", "SSL_verify_cert_chain"), {
    onEnter: function(args) {
        console.log("[+] Intercepted SSL_verify_cert_chain");
    },
    onLeave: function(retval) {
        console.log("[+] Bypassing SSL_verify_cert_chain verification");
        retval.replace(1); // Return success
    }
});

// Hook OpenSSL certificate verification
Interceptor.attach(Module.findExportByName("libssl.so", "X509_verify_cert"), {
    onEnter: function(args) {
        console.log("[+] Intercepted X509_verify_cert");
    },
    onLeave: function(retval) {
        console.log("[+] Bypassing X509_verify_cert verification");
        retval.replace(1); // Return success
    }
});

// Hook common certificate validation functions
var certValidationFuncs = [
    "SSL_CTX_check_private_key",
    "SSL_check_private_key",
    "X509_check_private_key",
    "SSL_get_verify_result"
];

certValidationFuncs.forEach(function(funcName) {
    try {
        Interceptor.attach(Module.findExportByName(null, funcName), {
            onEnter: function(args) {
                console.log("[+] Intercepted " + funcName);
            },
            onLeave: function(retval) {
                console.log("[+] Bypassing " + funcName + " validation");
                retval.replace(1); // Return success
            }
        });
    } catch (e) {
        console.log("[-] Could not hook " + funcName + ": " + e);
    }
});

// Hook Android-specific SSL functions
try {
    var appDataDir = "/data/data/" + Process.getCurrentThread().context;

    // Hook file read for certificate files
    var openPtr = Module.findExportByName(null, "open");
    Interceptor.attach(openPtr, {
        onEnter: function(args) {
            var path = Memory.readUtf8String(args[0]);
            if (path && (path.includes(".crt") || path.includes(".pem") || path.includes(".cer"))) {
                console.log("[+] Certificate file access: " + path);
                this.certFile = true;
            }
        },
        onLeave: function(retval) {
            if (this.certFile) {
                console.log("[+] Certificate file opened, will bypass validation");
            }
        }
    });
} catch (e) {
    console.log("[-] Could not hook file operations: " + e);
}

// Global SSL context manipulation
try {
    var SSLContext = Java.use("javax.net.ssl.SSLContext");

    SSLContext.init.implementation = function(keyManagers, trustManagers, secureRandom) {
        console.log("[+] Intercepting SSLContext.init");

        // Create a trust manager that accepts all certificates
        var TrustAllManager = Java.registerClass({
            name: 'com.example.TrustAllManager',
            implements: [Java.use("javax.net.ssl.X509TrustManager")],
            methods: {
                checkClientTrusted: function(chain, authType) {
                    console.log("[+] TrustAllManager: checkClientTrusted bypassed");
                },
                checkServerTrusted: function(chain, authType) {
                    console.log("[+] TrustAllManager: checkServerTrusted bypassed");
                },
                getAcceptedIssuers: function() {
                    return [];
                }
            }
        });

        var trustAllManager = TrustAllManager.$new();
        return this.init(keyManagers, [trustAllManager], secureRandom);
    };
} catch (e) {
    console.log("[-] Could not hook SSLContext: " + e);
}

console.log("[*] SSL Certificate Unpinning Script Loaded Successfully");
console.log("[*] All SSL certificate validations will be bypassed");

// Export helper functions for use by other scripts
global.SSLBypass = {
    isBypassActive: function() {
        return true;
    },

    logCertificate: function(cert) {
        console.log("[+] Certificate intercepted:");
        console.log("    Subject: " + cert.getSubjectX500Principal().getName());
        console.log("    Issuer: " + cert.getIssuerX500Principal().getName());
        console.log("    Serial: " + cert.getSerialNumber().toString(16));
    },

    bypassHostnameCheck: function(hostname) {
        console.log("[+] Manually bypassing hostname check for: " + hostname);
        return true;
    }
};