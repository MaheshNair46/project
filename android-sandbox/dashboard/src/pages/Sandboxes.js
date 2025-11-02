import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Modal,
  message,
  Tooltip,
  Badge,
  Row,
  Col,
  Statistic,
  Typography,
  Dropdown,
  Menu,
} from 'antd';
import {
  PlusOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  DeleteOutlined,
  ReloadOutlined,
  EyeOutlined,
  SettingOutlined,
  MoreOutlined,
  SearchOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import moment from 'moment';
import { sandboxApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const { Search } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

const StyledCard = styled(Card)`
  margin-bottom: 24px;
  .ant-card-head {
    border-bottom: 1px solid #f0f0f0;
  }
`;

const StatusTag = ({ status }) => {
  const statusConfig = {
    running: { color: 'green', text: 'Running' },
    starting: { color: 'blue', text: 'Starting' },
    stopped: { color: 'default', text: 'Stopped' },
    stopping: { color: 'orange', text: 'Stopping' },
    failed: { color: 'red', text: 'Failed' },
    creating: { color: 'processing', text: 'Creating' },
  };

  const config = statusConfig[status] || { color: 'default', text: status };

  return <Tag color={config.color}>{config.text}</Tag>;
};

const Sandboxes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingSandbox, setDeletingSandbox] = useState(null);

  // Queries
  const {
    data: sandboxesData,
    isLoading,
    refetch,
  } = useQuery(
    ['sandboxes', { search: searchTerm, status: statusFilter }],
    () => sandboxApi.getSandboxes({
      search: searchTerm,
      status: statusFilter,
    }),
    {
      select: (response) => response.data,
    }
  );

  const { data: stats } = useQuery(
    'sandboxStats',
    () => sandboxApi.getStats(),
    {
      select: (response) => response.data,
    }
  );

  // Mutations
  const startMutation = useMutation(sandboxApi.startSandbox, {
    onSuccess: () => {
      message.success('Sandbox started successfully');
      queryClient.invalidateQueries('sandboxes');
      queryClient.invalidateQueries('sandboxStats');
    },
    onError: (error) => {
      message.error(`Failed to start sandbox: ${error.message}`);
    },
  });

  const stopMutation = useMutation(sandboxApi.stopSandbox, {
    onSuccess: () => {
      message.success('Sandbox stopped successfully');
      queryClient.invalidateQueries('sandboxes');
      queryClient.invalidateQueries('sandboxStats');
    },
    onError: (error) => {
      message.error(`Failed to stop sandbox: ${error.message}`);
    },
  });

  const deleteMutation = useMutation(sandboxApi.deleteSandbox, {
    onSuccess: () => {
      message.success('Sandbox deleted successfully');
      queryClient.invalidateQueries('sandboxes');
      queryClient.invalidateQueries('sandboxStats');
      setDeleteModalVisible(false);
      setDeletingSandbox(null);
    },
    onError: (error) => {
      message.error(`Failed to delete sandbox: ${error.message}`);
    },
  });

  // Table columns
  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Button
          type="link"
          onClick={() => navigate(`/sandboxes/${record.id}`)}
          style={{ padding: 0 }}
        >
          {text}
        </Button>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <StatusTag status={status} />,
      filters: [
        { text: 'Running', value: 'running' },
        { text: 'Stopped', value: 'stopped' },
        { text: 'Failed', value: 'failed' },
        { text: 'Starting', value: 'starting' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Android Version',
      dataIndex: 'android_version',
      key: 'android_version',
      render: (version) => <Tag>{version}</Tag>,
    },
    {
      title: 'Device Profile',
      dataIndex: 'device_profile',
      key: 'device_profile',
      render: (profile) => <Tag color="blue">{profile}</Tag>,
    },
    {
      title: 'IP Address',
      dataIndex: 'ip_address',
      key: 'ip_address',
      render: (ip) => (ip ? <Text code>{ip}</Text> : '-'),
    },
    {
      title: 'Ports',
      key: 'ports',
      render: (_, record) => (
        <Space>
          {record.adb_port && (
            <Tooltip title="ADB Port">
              <Tag color="green">ADB: {record.adb_port}</Tag>
            </Tooltip>
          )}
          {record.vnc_port && (
            <Tooltip title="VNC Port">
              <Tag color="orange">VNC: {record.vnc_port}</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => moment(date).format('YYYY-MM-DD HH:mm'),
      sorter: (a, b) => moment(a.created_at).unix() - moment(b.created_at).unix(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'view',
            label: 'View Details',
            icon: <EyeOutlined />,
            onClick: () => navigate(`/sandboxes/${record.id}`),
          },
          {
            key: 'settings',
            label: 'Settings',
            icon: <SettingOutlined />,
            onClick: () => navigate(`/sandboxes/${record.id}/settings`),
          },
        ];

        if (record.status === 'running') {
          menuItems.unshift({
            key: 'stop',
            label: 'Stop',
            icon: <PauseCircleOutlined />,
            onClick: () => handleStop(record.id),
          });
        } else if (record.status === 'stopped') {
          menuItems.unshift({
            key: 'start',
            label: 'Start',
            icon: <PlayCircleOutlined />,
            onClick: () => handleStart(record.id),
          });
        }

        menuItems.push({
          key: 'delete',
          label: 'Delete',
          icon: <DeleteOutlined />,
          danger: true,
          onClick: () => handleDelete(record),
        });

        return (
          <Space>
            <Dropdown
              menu={{ items: menuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button icon={<MoreOutlined />} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  // Handlers
  const handleStart = (id) => {
    startMutation.mutate(id);
  };

  const handleStop = (id) => {
    stopMutation.mutate(id);
  };

  const handleDelete = (sandbox) => {
    setDeletingSandbox(sandbox);
    setDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    if (deletingSandbox) {
      deleteMutation.mutate(deletingSandbox.id);
    }
  };

  const handleBatchStart = () => {
    // Implement batch start functionality
    message.info('Batch start functionality coming soon');
  };

  const handleBatchStop = () => {
    // Implement batch stop functionality
    message.info('Batch stop functionality coming soon');
  };

  const handleBatchDelete = () => {
    // Implement batch delete functionality
    message.info('Batch delete functionality coming soon');
  };

  // Row selection
  const rowSelection = {
    selectedRowKeys,
    onChange: setSelectedRowKeys,
  };

  return (
    <div>
      <StyledCard>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic
              title="Total Sandboxes"
              value={stats?.total || 0}
              prefix={<PlusOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Running"
              value={stats?.running || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<PlayCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Stopped"
              value={stats?.stopped || 0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<PauseCircleOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Failed"
              value={stats?.failed || 0}
              valueStyle={{ color: '#d4b106' }}
              prefix={<ReloadOutlined />}
            />
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Search
              placeholder="Search sandboxes..."
              allowClear
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="Filter by status"
              allowClear
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              prefix={<FilterOutlined />}
            >
              <Option value="running">Running</Option>
              <Option value="stopped">Stopped</Option>
              <Option value="failed">Failed</Option>
              <Option value="starting">Starting</Option>
            </Select>
          </Col>
          <Col span={10}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => navigate('/sandboxes/create')}
              >
                Create Sandbox
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
                loading={isLoading}
              >
                Refresh
              </Button>
              {selectedRowKeys.length > 0 && (
                <>
                  <Button onClick={handleBatchStart}>
                    Start Selected
                  </Button>
                  <Button onClick={handleBatchStop}>
                    Stop Selected
                  </Button>
                  <Button danger onClick={handleBatchDelete}>
                    Delete Selected
                  </Button>
                </>
              )}
            </Space>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={sandboxesData?.sandboxes || []}
          rowKey="id"
          loading={isLoading}
          rowSelection={rowSelection}
          pagination={{
            current: sandboxesData?.pagination?.page || 1,
            pageSize: sandboxesData?.pagination?.limit || 20,
            total: sandboxesData?.pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
        />
      </StyledCard>

      <Modal
        title="Delete Sandbox"
        visible={deleteModalVisible}
        onOk={confirmDelete}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeletingSandbox(null);
        }}
        confirmLoading={deleteMutation.isLoading}
        okText="Delete"
        okType="danger"
      >
        <p>
          Are you sure you want to delete the sandbox "
          <strong>{deletingSandbox?.name}</strong>"?
        </p>
        <p>This action cannot be undone.</p>
      </Modal>
    </div>
  );
};

export default Sandboxes;