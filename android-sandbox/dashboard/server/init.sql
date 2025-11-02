-- Android Sandbox Database Schema
-- Initialize tables for the Android Sandbox Management System

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'analyst',
    permissions TEXT[] DEFAULT ARRAY['sandbox:read', 'sandbox:create'],
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sandboxes table
CREATE TABLE IF NOT EXISTS sandboxes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    android_version VARCHAR(10) DEFAULT '12',
    device_profile VARCHAR(50) DEFAULT 'pixel-5',
    network_config JSONB DEFAULT '{}',
    analysis_tools TEXT[] DEFAULT ARRAY['logcat'],
    security_policy VARCHAR(50) DEFAULT 'analysis-mode',
    status VARCHAR(20) DEFAULT 'creating',
    container_id VARCHAR(100),
    adb_port INTEGER,
    vnc_port INTEGER,
    ip_address INET,
    error_message TEXT,
    tags TEXT[] DEFAULT ARRAY[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE,
    failed_at TIMESTAMP WITH TIME ZONE,
    restarted_at TIMESTAMP WITH TIME ZONE
);

-- Sandbox logs table
CREATE TABLE IF NOT EXISTS sandbox_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    level VARCHAR(10) NOT NULL,
    message TEXT NOT NULL,
    source VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Network captures table
CREATE TABLE IF NOT EXISTS network_captures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT,
    interface VARCHAR(50),
    filter TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'running'
);

-- Analysis results table
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sandbox_id UUID NOT NULL REFERENCES sandboxes(id) ON DELETE CASCADE,
    tool VARCHAR(50) NOT NULL,
    result_type VARCHAR(50) NOT NULL,
    result_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configurations table
CREATE TABLE IF NOT EXISTS configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'device', 'network', 'security'
    config_data JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sandboxes_user_id ON sandboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_sandboxes_status ON sandboxes(status);
CREATE INDEX IF NOT EXISTS idx_sandboxes_created_at ON sandboxes(created_at);
CREATE INDEX IF NOT EXISTS idx_sandbox_logs_sandbox_id ON sandbox_logs(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_logs_created_at ON sandbox_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_network_captures_sandbox_id ON network_captures(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_sandbox_id ON analysis_results(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sandboxes_updated_at BEFORE UPDATE ON sandboxes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_configurations_updated_at BEFORE UPDATE ON configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
-- Note: Change this password in production!
INSERT INTO users (username, email, password_hash, role, permissions)
VALUES (
    'admin',
    'admin@android-sandbox.local',
    crypt('admin123', gen_salt('bf')),
    'admin',
    ARRAY['sandbox:read', 'sandbox:create', 'sandbox:update', 'sandbox:delete', 'sandbox:control', 'user:read', 'user:create', 'user:update', 'config:read', 'config:create', 'config:update', 'analysis:read', 'analysis:create', 'monitoring:read']
) ON CONFLICT (username) DO NOTHING;

-- Insert default configurations
INSERT INTO configurations (name, type, config_data, is_default)
VALUES
    ('Pixel 5', 'device', '{
        "name": "Pixel 5",
        "manufacturer": "Google",
        "android": {
            "version": "12",
            "api_level": 31
        },
        "hardware": {
            "ram_mb": 4096,
            "storage_gb": 128,
            "screen": {
                "resolution": "1080x2340",
                "density": 440
            }
        }
    }', true),
    ('Standard Network', 'network', '{
        "name": "Standard Network",
        "type": "custom_bridge",
        "ip": {
            "range": "192.168.100.0/24",
            "gateway": "192.168.100.1",
            "dns_servers": ["8.8.8.8", "8.8.4.4"]
        }
    }', true),
    ('Analysis Mode', 'security', '{
        "name": "Analysis Mode",
        "device": {
            "selinux": "permissive",
            "root_access": true,
            "developer_options": true
        },
        "network": {
            "trust_all_certificates": true,
            "enable_packet_capture": true
        }
    }', true)
ON CONFLICT DO NOTHING;

-- Create view for sandbox statistics
CREATE OR REPLACE VIEW sandbox_stats AS
SELECT
    status,
    COUNT(*) as count,
    AVG(CASE WHEN started_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (COALESCE(stopped_at, NOW()) - started_at))
        ELSE NULL END) as avg_runtime_seconds
FROM sandboxes
GROUP BY status;

-- Create view for user activity
CREATE OR REPLACE VIEW user_activity AS
SELECT
    u.id,
    u.username,
    u.email,
    u.last_login,
    COUNT(DISTINCT s.id) as total_sandboxes,
    COUNT(DISTINCT CASE WHEN s.status = 'running' THEN s.id END) as active_sandboxes,
    COUNT(DISTINCT al.id) as total_actions
FROM users u
LEFT JOIN sandboxes s ON u.id = s.user_id
LEFT JOIN audit_logs al ON u.id = al.user_id
GROUP BY u.id, u.username, u.email, u.last_login;