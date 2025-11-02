/*
 * Network Monitoring Script for Android
 * Monitors and logs network activities including HTTP requests,
 * socket operations, and DNS queries
 *
 * This script provides comprehensive network monitoring capabilities
 * for security analysis and malware research.
 */

console.log("[*] Network Monitoring Script Started");

// Configuration
var config = {
    logHTTPRequests: true,
    logSockets: true,
    logDNS: true,
    logSSL: true,
    logData: false, // Set to true to log actual data (may be verbose)
    maxLogLength: 500,
    excludeLocalHost: true,
    excludeCommonPorts: false
};

// Utility functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    var k = 1024;
    var sizes = ['Bytes', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function shouldExcludeHost(host) {
    if (config.excludeLocalHost && (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.'))) {
        return true;
    }
    return false;
}

function shouldExcludePort(port) {
    if (config.excludeCommonPorts && [22, 80, 443, 53, 135, 139, 445].includes(parseInt(port))) {
        return true;
    }
    return false;
}

function truncateData(data) {
    if (!data || data.length <= config.maxLogLength) {
        return data;
    }
    return data.substring(0, config.maxLogLength) + "... [truncated]";
}

// HTTP/HTTPS Monitoring
if (config.logHTTPRequests) {
    Java.perform(function() {
        console.log("[+] Hooking HTTP/HTTPS methods");

        try {
            // Hook HttpURLConnection
            var HttpURLConnection = Java.use("java.net.HttpURLConnection");

            HttpURLConnection.connect.implementation = function() {
                var url = this.getURL().toString();
                var method = this.getRequestMethod();

                console.log("[HTTP] " + method + " " + url);
                console.log("    User-Agent: " + this.getRequestProperty("User-Agent"));
                console.log("    Headers: " + JSON.stringify(this.getRequestProperties()));

                return this.connect();
            };

            HttpURLConnection.getResponseCode.implementation = function() {
                var code = this.getResponseCode();
                var url = this.getURL().toString();

                console.log("[HTTP] Response: " + code + " for " + url);
                console.log("    Content-Type: " + this.getContentType());
                console.log("    Content-Length: " + this.getContentLength());

                return code;
            };

            // Hook OkHttp3
            try {
                var OkHttpClient = Java.use("okhttp3.OkHttpClient");
                var Request = Java.use("okhttp3.Request");

                var Call = Java.use("okhttp3.Call");
                Call.execute.implementation = function() {
                    var request = this.request();
                    var url = request.url().toString();
                    var method = request.method();

                    console.log("[OkHttp] " + method + " " + url);

                    // Log headers
                    var headers = request.headers();
                    console.log("    Headers: " + headers.toString());

                    return this.execute();
                };
            } catch (e) {
                console.log("[-] OkHttp3 not found: " + e);
            }

            // Hook Apache HttpClient
            try {
                var HttpClient = Java.use("org.apache.http.client.HttpClient");
                var HttpUriRequest = Java.use("org.apache.http.client.methods.HttpUriRequest");

                HttpUriRequest.execute.implementation = function() {
                    var uri = this.getURI().toString();
                    var method = this.getMethod();

                    console.log("[Apache] " + method + " " + uri);

                    return this.execute();
                };
            } catch (e) {
                console.log("[-] Apache HttpClient not found: " + e);
            }

        } catch (e) {
            console.log("[-] Error hooking HTTP methods: " + e);
        }
    });
}

// Socket Monitoring
if (config.logSockets) {
    // Hook socket functions
    var socketFuncs = [
        { name: "socket", type: "create" },
        { name: "connect", type: "connect" },
        { name: "bind", type: "bind" },
        { name: "send", type: "send" },
        { name: "recv", type: "recv" },
        { name: "sendto", type: "sendto" },
        { name: "recvfrom", type: "recvfrom" }
    ];

    socketFuncs.forEach(function(func) {
        try {
            Interceptor.attach(Module.findExportByName(null, func.name), {
                onEnter: function(args) {
                    this.logData = {
                        type: func.type,
                        timestamp: new Date().toISOString()
                    };

                    if (func.type === "connect") {
                        var sockaddr_ptr = args[1];
                        var family = Memory.readU16(sockaddr_ptr);
                        var port = 0;
                        var ip = "";

                        if (family === 2) { // AF_INET
                            port = Memory.readU16(sockaddr_ptr.add(2));
                            var ip_bytes = [
                                Memory.readU8(sockaddr_ptr.add(4)),
                                Memory.readU8(sockaddr_ptr.add(5)),
                                Memory.readU8(sockaddr_ptr.add(6)),
                                Memory.readU8(sockaddr_ptr.add(7))
                            ];
                            ip = ip_bytes.join(".");
                        } else if (family === 10) { // AF_INET6
                            port = Memory.readU16(sockaddr_ptr.add(2));
                            // IPv6 parsing would go here
                            ip = "IPv6 address";
                        }

                        this.logData.host = ip;
                        this.logData.port = port;

                        if (!shouldExcludeHost(ip) && !shouldExcludePort(port)) {
                            console.log("[SOCKET] Connecting to " + ip + ":" + port);
                        }
                    } else if (func.type === "send" || func.type === "sendto") {
                        var data_len = args[2].toInt32();
                        this.logData.data_size = data_len;

                        if (config.logData && data_len > 0 && data_len < 4096) {
                            var data = Memory.readUtf8String(args[1], data_len);
                            this.logData.data = truncateData(data);
                        }
                    } else if (func.type === "recv" || func.type === "recvfrom") {
                        this.logData.buffer = args[1];
                        this.logData.max_len = args[2].toInt32();
                    }
                },
                onLeave: function(retval) {
                    if (this.logData && config.logSockets) {
                        if (this.logData.type === "send" || this.logData.type === "sendto") {
                            console.log("[SOCKET] Sent " + formatBytes(this.logData.data_size) + " bytes");
                            if (this.logData.data) {
                                console.log("    Data: " + this.logData.data);
                            }
                        } else if (this.logData.type === "recv" || this.logData.type === "recvfrom") {
                            var bytes_received = retval.toInt32();
                            if (bytes_received > 0) {
                                console.log("[SOCKET] Received " + formatBytes(bytes_received) + " bytes");
                                if (config.logData && bytes_received > 0 && bytes_received < 4096) {
                                    var data = Memory.readUtf8String(this.logData.buffer, bytes_received);
                                    console.log("    Data: " + truncateData(data));
                                }
                            }
                        }
                    }
                }
            });
        } catch (e) {
            console.log("[-] Could not hook " + func.name + ": " + e);
        }
    });
}

// DNS Monitoring
if (config.logDNS) {
    // Hook getaddrinfo
    try {
        Interceptor.attach(Module.findExportByName(null, "getaddrinfo"), {
            onEnter: function(args) {
                this.hostname = Memory.readUtf8String(args[0]);
            },
            onLeave: function(retval) {
                if (this.hostname) {
                    console.log("[DNS] Query: " + this.hostname);
                    if (retval.toInt32() === 0) {
                        console.log("    Status: Success");
                    } else {
                        console.log("    Status: Failed (error: " + retval + ")");
                    }
                }
            }
        });
    } catch (e) {
        console.log("[-] Could not hook getaddrinfo: " + e);
    }

    // Hook Java DNS resolution
    Java.perform(function() {
        try {
            var InetAddress = Java.use("java.net.InetAddress");

            InetAddress.getByName.implementation = function(host) {
                console.log("[DNS] Java lookup: " + host);
                var result = this.getByName(host);
                console.log("    Result: " + result.getHostAddress());
                return result;
            };

            InetAddress.getAllByName.implementation = function(host) {
                console.log("[DNS] Java lookup (all): " + host);
                var result = this.getAllByName(host);
                result.forEach(function(addr) {
                    console.log("    Result: " + addr.getHostAddress());
                });
                return result;
            };
        } catch (e) {
            console.log("[-] Could not hook Java DNS methods: " + e);
        }
    });
}

// SSL/TLS Monitoring
if (config.logSSL) {
    Java.perform(function() {
        console.log("[+] Hooking SSL/TLS methods");

        try {
            // Hook SSLSocket
            var SSLSocket = Java.use("javax.net.ssl.SSLSocket");

            SSLSocket.startHandshake.implementation = function() {
                console.log("[SSL] Handshake started");
                var session = this.getSession();
                console.log("    Cipher Suite: " + session.getCipherSuite());
                console.log("    Protocol: " + session.getProtocol());

                return this.startHandshake();
            };

            // Hook SSLContext
            var SSLContext = Java.use("javax.net.ssl.SSLContext");

            SSLContext.createSSLEngine.implementation = function() {
                console.log("[SSL] Creating SSLEngine");
                var engine = this.createSSLEngine();

                engine.beginHandshake.implementation = function() {
                    console.log("[SSL] Engine handshake started");
                    return this.beginHandshake();
                };

                return engine;
            };
        } catch (e) {
            console.log("[-] Could not hook SSL methods: " + e);
        }
    });
}

// Network statistics
var stats = {
    httpRequests: 0,
    socketConnections: 0,
    dnsQueries: 0,
    sslHandshakes: 0,
    bytesSent: 0,
    bytesReceived: 0
};

// Export monitoring functions
global.NetworkMonitor = {
    getStats: function() {
        return Object.assign({}, stats);
    },

    resetStats: function() {
        stats.httpRequests = 0;
        stats.socketConnections = 0;
        stats.dnsQueries = 0;
        stats.sslHandshakes = 0;
        stats.bytesSent = 0;
        stats.bytesReceived = 0;
    },

    setConfig: function(newConfig) {
        Object.assign(config, newConfig);
        console.log("[*] Network monitor configuration updated");
    },

    logNetworkActivity: function(type, details) {
        console.log("[NETWORK] " + type + ": " + JSON.stringify(details));

        // Update statistics
        switch (type) {
            case "http_request":
                stats.httpRequests++;
                break;
            case "socket_connect":
                stats.socketConnections++;
                break;
            case "dns_query":
                stats.dnsQueries++;
                break;
            case "ssl_handshake":
                stats.sslHandshakes++;
                break;
        }
    }
};

console.log("[*] Network Monitoring Script Loaded Successfully");
console.log("[*] Monitoring HTTP requests, sockets, DNS queries, and SSL/TLS connections");

// Show statistics every 30 seconds
setInterval(function() {
    console.log("[STATS] HTTP: " + stats.httpRequests +
                ", Sockets: " + stats.socketConnections +
                ", DNS: " + stats.dnsQueries +
                ", SSL: " + stats.sslHandshakes);
}, 30000);