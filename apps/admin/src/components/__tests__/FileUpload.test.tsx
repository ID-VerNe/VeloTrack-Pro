// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUpload } from '../FileUpload';

// 构造测试用 File 对象（content 决定 size，用于展示文件大小）
const makeFile = (name: string, content = 'test content'): File =>
  new File([content], name, { type: 'text/xml' });

const tcxFile = makeFile('ride-2024.tcx');
const gpxFile = makeFile('track.gpx');
const txtFile = makeFile('note.txt');

describe('FileUpload 文件上传组件', () => {
  const onFilesSelect = vi.fn();

  beforeEach(() => {
    onFilesSelect.mockClear();
  });

  it('idle 状态默认渲染拖入提示且上传按钮禁用', () => {
    render(<FileUpload onFilesSelect={onFilesSelect} status="idle" />);
    expect(screen.getByText('拖入 TCX 或 GPX 骑行文件至此处')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /一键脱敏并同步/ })
    ).toBeDisabled();
  });

  it('选择文件后显示暂存列表、按钮可用，点击触发 onFilesSelect', () => {
    render(<FileUpload onFilesSelect={onFilesSelect} status="idle" />);
    const input = screen.getByLabelText('选取或拖入骑行数据文件');
    fireEvent.change(input, { target: { files: [tcxFile, gpxFile] } });

    // 暂存区文案与文件清单
    expect(screen.getByText(/已暂存 2 个骑行文件/)).toBeInTheDocument();
    expect(screen.getByText('待上传文件清单 (2)')).toBeInTheDocument();
    expect(screen.getByText('ride-2024.tcx')).toBeInTheDocument();
    expect(screen.getByText('track.gpx')).toBeInTheDocument();

    const uploadBtn = screen.getByRole('button', {
      name: /一键脱敏并同步 2 个活动/,
    });
    expect(uploadBtn).toBeEnabled();
    fireEvent.click(uploadBtn);
    expect(onFilesSelect).toHaveBeenCalledTimes(1);
    expect(onFilesSelect).toHaveBeenCalledWith([tcxFile, gpxFile]);
  });

  it('未选择文件时点击上传按钮不会触发回调', () => {
    render(<FileUpload onFilesSelect={onFilesSelect} status="idle" />);
    fireEvent.click(
      screen.getByRole('button', { name: /一键脱敏并同步/ })
    );
    expect(onFilesSelect).not.toHaveBeenCalled();
  });

  it('可单独移除某个文件，也可清空全部待选', () => {
    render(<FileUpload onFilesSelect={onFilesSelect} status="idle" />);
    const input = screen.getByLabelText('选取或拖入骑行数据文件');
    fireEvent.change(input, { target: { files: [tcxFile, gpxFile] } });

    // 移除第一个文件
    const removeButtons = screen.getAllByTitle('移除该文件');
    expect(removeButtons).toHaveLength(2);
    fireEvent.click(removeButtons[0]);
    expect(screen.queryByText('ride-2024.tcx')).not.toBeInTheDocument();
    expect(screen.getByText('track.gpx')).toBeInTheDocument();

    // 清空全部
    fireEvent.click(screen.getByText('清空待选'));
    expect(screen.queryByText('track.gpx')).not.toBeInTheDocument();
    expect(screen.queryByText('待上传文件清单')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /一键脱敏并同步/ })
    ).toBeDisabled();
  });

  it('拖拽进入时高亮激活区域，拖离后取消高亮', () => {
    render(<FileUpload onFilesSelect={onFilesSelect} status="idle" />);
    const dropZone = screen.getByLabelText('选取或拖入骑行数据文件')
      .parentElement as HTMLElement;

    fireEvent.dragEnter(dropZone);
    expect(dropZone.className).toContain('border-blue-500');

    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).not.toContain('border-blue-500');
  });

  it('拖入时仅接受 .tcx / .gpx 文件并暂存', () => {
    render(<FileUpload onFilesSelect={onFilesSelect} status="idle" />);
    const dropZone = screen.getByLabelText('选取或拖入骑行数据文件')
      .parentElement as HTMLElement;

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [tcxFile, gpxFile, txtFile] },
    });
    expect(screen.getByText('ride-2024.tcx')).toBeInTheDocument();
    expect(screen.getByText('track.gpx')).toBeInTheDocument();
    expect(screen.queryByText('note.txt')).not.toBeInTheDocument();
  });

  it('上传中展示进度条与当前文件名，输入与按钮均禁用', () => {
    render(
      <FileUpload
        onFilesSelect={onFilesSelect}
        status="uploading"
        batchProgress={{
          total: 4,
          current: 2,
          currentFileName: 'track.gpx',
          successCount: 1,
          failedCount: 0,
        }}
      />
    );
    expect(screen.getByText('正在处理批量同步 (2 / 4)...')).toBeInTheDocument();
    expect(screen.getByText('track.gpx')).toBeInTheDocument();
    expect(
      screen.getByText('50% 完成（已成功导入 1 个活动）')
    ).toBeInTheDocument();
    expect(screen.getByText('正在批量脱敏并同步...')).toBeInTheDocument();
    expect(screen.getByLabelText('选取或拖入骑行数据文件')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /正在批量脱敏并同步/ })
    ).toBeDisabled();
  });

  it('success 状态显示批量上传成功文案', () => {
    render(<FileUpload onFilesSelect={onFilesSelect} status="success" />);
    expect(screen.getByText('批量上传并脱敏成功！')).toBeInTheDocument();
  });

  it('error 状态展示导入异常与错误信息', () => {
    render(
      <FileUpload
        onFilesSelect={onFilesSelect}
        status="error"
        errorMessage="文件解析失败：格式不支持"
      />
    );
    expect(screen.getByText('导入过程中遇到异常')).toBeInTheDocument();
    expect(screen.getByText('文件解析失败：格式不支持')).toBeInTheDocument();
  });
});
