import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Steps,
  Row,
  Col,
  Switch,
  InputNumber,
  Tag,
  Space,
  Alert,
  Collapse,
  Descriptions,
  Typography,
  Divider,
  Checkbox,
  message,
} from 'antd';
import {
  MobileOutlined,
  SettingOutlined,
  SafetyOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { sandboxApi, configApi } from '../services/api';

const { Title, Text } = Typography;
const { Panel } = Collapse;
const { Step } = Steps;
const { Option } = Select;

const StyledCard = styled(Card)`
  margin-bottom: 24px;
`;

const StepContent = styled.div`
  min-height: 400px;
  padding: 24px 0;
`;

const CreateSandbox = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [sandboxConfig, setSandboxConfig] = useState({});
  const [autoStart, setAutoStart] = useState(false);

  // Queries
  const { data: deviceTemplates } = useQuery(
    'deviceTemplates',
    () => configApi.getDeviceTemplates(),
    {
      select: (response) => response.data,
    }
  );

  const { data: networkProfiles } = useQuery(
    'networkProfiles',
    () => configApi.getNetworkProfiles(),
    {
      select: (response) => response.data,
    }
  );

  const { data: securityPolicies } = useQuery(
    'securityPolicies',
    () => configApi.getSecurityPolicies(),
    {
      select: (response) => response.data,
    }
  );

  // Mutations
  const createMutation = useMutation(sandboxApi.createSandbox, {
    onSuccess: (response) => {
      message.success('Sandbox created successfully!');
      if (autoStart && response.data.status === 'running') {
        navigate(`/sandboxes/${response.data.id}`);
      } else {
        navigate('/sandboxes');
      }
    },
    onError: (error) => {
      message.error(`Failed to create sandbox: ${error.message}`);
    },
  });

  // Steps configuration
  const steps = [
    {
      title: 'Basic Info',
      icon: <MobileOutlined />,
      content: 'BasicInfoStep',
    },
    {
      title: 'Device Config',
      icon: <SettingOutlined />,
      content: 'DeviceConfigStep',
    },
    {
      title: 'Network Config',
      icon: <SettingOutlined />,
      content: 'NetworkConfigStep',
    },
    {
      title: 'Security & Tools',
      icon: <SafetyOutlined />,
      content: 'SecurityToolsStep',
    },
    {
      title: 'Review & Create',
      icon: <CheckOutlined />,
      content: 'ReviewStep',
    },
  ];

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        await form.validateFields(['name']);
      } else if (currentStep === 1) {
        await form.validateFields(['android_version', 'device_profile']);
      } else if (currentStep === 2) {
        await form.validateFields(['network_config']);
      } else if (currentStep === 3) {
        await form.validateFields(['analysis_tools', 'security_policy']);
      }

      const values = form.getFieldsValue();
      setSandboxConfig({ ...sandboxConfig, ...values });
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const finalConfig = { ...sandboxConfig, ...values };

      createMutation.mutate(finalConfig);
    } catch (error) {
      console.error('Validation error:', error);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return <BasicInfoStep />;
      case 1:
        return <DeviceConfigStep />;
      case 2:
        return <NetworkConfigStep />;
      case 3:
        return <SecurityToolsStep />;
      case 4:
        return <ReviewStep />;
      default:
        return null;
    }
  };

  const BasicInfoStep = () => (
    <StepContent>
      <Title level={3}>Basic Information</Title>
      <Text type="secondary">
        Configure the basic information for your Android sandbox.
      </Text>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Form.Item
            label="Sandbox Name"
            name="name"
            rules={[
              { required: true, message: 'Please enter a sandbox name' },
              { min: 3, message: 'Name must be at least 3 characters' },
              { max: 50, message: 'Name cannot exceed 50 characters' },
            ]}
          >
            <Input placeholder="e.g., Malware Analysis Sandbox" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Tags" name="tags">
            <Select
              mode="tags"
              placeholder="Add tags for organization"
              style={{ width: '100%' }}
            >
              <Option value="malware-analysis">Malware Analysis</Option>
              <Option value="app-testing">App Testing</Option>
              <Option value="security-research">Security Research</Option>
              <Option value="development">Development</Option>
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item label="Auto Start" name="auto_start" valuePropName="checked">
            <Switch
              checked={autoStart}
              onChange={setAutoStart}
            />
          </Form.Item>
          <Text type="secondary">
            Automatically start the sandbox after creation
          </Text>
        </Col>
      </Row>
    </StepContent>
  );

  const DeviceConfigStep = () => (
    <StepContent>
      <Title level={3}>Device Configuration</Title>
      <Text type="secondary">
        Choose the Android version and device profile for your sandbox.
      </Text>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Form.Item
            label="Android Version"
            name="android_version"
            rules={[{ required: true, message: 'Please select an Android version' }]}
          >
            <Select placeholder="Select Android version">
              <Option value="11">Android 11 (API 30)</Option>
              <Option value="12">Android 12 (API 31)</Option>
              <Option value="13">Android 13 (API 33)</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="Device Profile"
            name="device_profile"
            rules={[{ required: true, message: 'Please select a device profile' }]}
          >
            <Select placeholder="Select device profile">
              {deviceTemplates?.map((template) => (
                <Option key={template.name} value={template.name}>
                  {template.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item label="RAM (MB)" name="ram_mb">
            <InputNumber
              min={2048}
              max={16384}
              step={1024}
              defaultValue={4096}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="CPU Limit (%)" name="cpu_limit">
            <InputNumber
              min={10}
              max={100}
              step={10}
              defaultValue={50}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Alert
        message="Resource Allocation"
        description="RAM and CPU limits affect the performance of your sandbox. Higher values provide better performance but consume more host resources."
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </StepContent>
  );

  const NetworkConfigStep = () => (
    <StepContent>
      <Title level={3}>Network Configuration</Title>
      <Text type="secondary">
        Configure network settings for your sandbox.
      </Text>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Form.Item
            label="Network Profile"
            name={['network_config', 'profile']}
            rules={[{ required: true, message: 'Please select a network profile' }]}
          >
            <Select placeholder="Select network profile">
              {networkProfiles?.map((profile) => (
                <Option key={profile.name} value={profile.name}>
                  {profile.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="IP Address"
            name={['network_config', 'ip_address']}
            rules={[
              { pattern: /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/, message: 'Invalid IP address format' }
            ]}
          >
            <Input placeholder="192.168.100.10" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="DNS Servers"
            name={['network_config', 'dns_servers']}
          >
            <Select
              mode="multiple"
              placeholder="Select DNS servers"
              defaultValue={['8.8.8.8', '8.8.4.4']}
            >
              <Option value="8.8.8.8">Google Primary (8.8.8.8)</Option>
              <Option value="8.8.4.4">Google Secondary (8.8.4.4)</Option>
              <Option value="1.1.1.1">Cloudflare Primary (1.1.1.1)</Option>
              <Option value="1.0.0.1">Cloudflare Secondary (1.0.0.1)</Option>
              <Option value="9.9.9.9">Quad9 Primary (9.9.9.9)</Option>
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="HTTP Proxy"
            name={['network_config', 'proxy']}
          >
            <Input placeholder="http://proxy.example.com:8080" />
          </Form.Item>
        </Col>
      </Row>

      <Divider />

      <Title level={4}>Traffic Shaping</Title>
      <Row gutter={24}>
        <Col span={8}>
          <Form.Item
            label="Bandwidth Limit (kbps)"
            name={['network_config', 'bandwidth_kbps']}
          >
            <InputNumber
              min={0}
              max={100000}
              step={100}
              placeholder="0 = unlimited"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Latency (ms)"
            name={['network_config', 'latency_ms']}
          >
            <InputNumber
              min={0}
              max={5000}
              step={10}
              placeholder="0 = no latency"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="Packet Loss (%)"
            name={['network_config', 'packet_loss_percent']}
          >
            <InputNumber
              min={0}
              max={100}
              step={0.1}
              placeholder="0 = no packet loss"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
      </Row>
    </StepContent>
  );

  const SecurityToolsStep = () => (
    <StepContent>
      <Title level={3}>Security & Analysis Tools</Title>
      <Text type="secondary">
        Configure security policies and analysis tools for your sandbox.
      </Text>

      <Row gutter={24} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Form.Item
            label="Security Policy"
            name="security_policy"
            rules={[{ required: true, message: 'Please select a security policy' }]}
          >
            <Select placeholder="Select security policy">
              {securityPolicies?.map((policy) => (
                <Option key={policy.name} value={policy.name}>
                  {policy.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={24}>
          <Form.Item
            label="Analysis Tools"
            name="analysis_tools"
            rules={[{ required: true, message: 'Please select at least one analysis tool' }]}
          >
            <Checkbox.Group>
              <Row>
                <Col span={6}>
                  <Checkbox value="frida">
                    <Space>
                      <Tag color="green">Frida</Tag>
                      <Text>Dynamic instrumentation</Text>
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={6}>
                  <Checkbox value="tcpdump">
                    <Space>
                      <Tag color="blue">TCPDump</Tag>
                      <Text>Network capture</Text>
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={6}>
                  <Checkbox value="strace">
                    <Space>
                      <Tag color="orange">Strace</Tag>
                      <Text>System call tracing</Text>
                    </Space>
                  </Checkbox>
                </Col>
                <Col span={6}>
                  <Checkbox value="logcat">
                    <Space>
                      <Tag color="purple">Logcat</Tag>
                      <Text>Android logging</Text>
                    </Space>
                  </Checkbox>
                </Col>
              </Row>
            </Checkbox.Group>
          </Form.Item>
        </Col>
      </Row>

      <Collapse style={{ marginTop: 24 }}>
        <Panel header="Security Policy Details" key="security-details">
          <Alert
            message="Security Policies"
            description={
              <div>
                <p><strong>Analysis Mode:</strong> Permissive security settings for malware analysis and reverse engineering.</p>
                <p><strong>Stealth Mode:</strong> Configured to evade detection while maintaining analysis capabilities.</p>
              </div>
            }
            type="info"
            showIcon
          />
        </Panel>
      </Collapse>
    </StepContent>
  );

  const ReviewStep = () => {
    const allValues = { ...sandboxConfig, ...form.getFieldsValue() };

    return (
      <StepContent>
        <Title level={3}>Review & Create</Title>
        <Text type="secondary">
          Review your sandbox configuration before creating.
        </Text>

        <Descriptions
          title="Sandbox Configuration"
          bordered
          column={2}
          style={{ marginTop: 24 }}
        >
          <Descriptions.Item label="Name" span={2}>
            {allValues.name}
          </Descriptions.Item>
          <Descriptions.Item label="Android Version">
            {allValues.android_version}
          </Descriptions.Item>
          <Descriptions.Item label="Device Profile">
            {allValues.device_profile}
          </Descriptions.Item>
          <Descriptions.Item label="Security Policy">
            {allValues.security_policy}
          </Descriptions.Item>
          <Descriptions.Item label="Auto Start">
            {allValues.auto_start ? 'Yes' : 'No'}
          </Descriptions.Item>
          <Descriptions.Item label="Analysis Tools" span={2}>
            <Space>
              {allValues.analysis_tools?.map((tool) => (
                <Tag key={tool} color="blue">{tool}</Tag>
              ))}
            </Space>
          </Descriptions.Item>
          {allValues.network_config?.ip_address && (
            <Descriptions.Item label="IP Address">
              {allValues.network_config.ip_address}
            </Descriptions.Item>
          )}
          {allValues.network_config?.profile && (
            <Descriptions.Item label="Network Profile">
              {allValues.network_config.profile}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Alert
          message="Ready to Create"
          description="Click 'Create Sandbox' to provision your Android sandbox. This may take a few minutes."
          type="success"
          showIcon
          style={{ marginTop: 24 }}
        />
      </StepContent>
    );
  };

  return (
    <div>
      <StyledCard>
        <Title level={2}>Create Android Sandbox</Title>

        <Steps current={currentStep} items={steps} style={{ marginBottom: 32 }} />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            android_version: '12',
            device_profile: 'pixel-5',
            security_policy: 'analysis-mode',
            analysis_tools: ['logcat'],
            network_config: {
              dns_servers: ['8.8.8.8', '8.8.4.4'],
            },
            auto_start: false,
          }}
        >
          {renderStepContent()}
        </Form>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {currentStep > 0 && (
              <Button onClick={handlePrev}>
                Previous
              </Button>
            )}
            {currentStep < steps.length - 1 && (
              <Button type="primary" onClick={handleNext}>
                Next
              </Button>
            )}
            {currentStep === steps.length - 1 && (
              <Button
                type="primary"
                loading={createMutation.isLoading}
                onClick={handleCreate}
              >
                Create Sandbox
              </Button>
            )}
          </Space>
        </div>
      </StyledCard>
    </div>
  );
};

export default CreateSandbox;