import 'package:flutter/material.dart';

import '../../core/api_client.dart';
import '../../core/auth_session.dart';
import '../../models/paginated_response.dart';
import '../../models/project.dart';
import '../../models/task.dart';

/// Cong viec cua toi (Doc/ECAP_Mobile.md muc 12) - CHI xem cong viec da duoc giao cho chinh
/// minh o TAT CA du an + doi trang thai theo dung TASK_STATUS_TRANSITIONS. Khong co bang Kanban
/// keo-tha, khong tao/xoa cong viec tren dien thoai - pham vi da thong nhat voi nguoi dung, giu
/// dung nhung gi tu nhien tren man hinh nho.
class TasksPage extends StatefulWidget {
  final ApiClient apiClient;
  final AuthSession session;

  const TasksPage({super.key, required this.apiClient, required this.session});

  @override
  State<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends State<TasksPage> {
  List<Task> _myTasks = [];
  Map<String, String> _projectNames = {};
  bool _loading = true;
  String? _errorMessage;
  String? _updatingTaskId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    final myUserId = widget.session.user?.id;
    try {
      final results = await Future.wait([
        widget.apiClient.get('/tasks', query: {'limit': 500}),
        widget.apiClient.get('/projects', query: {'limit': 500}),
      ]);
      final taskPage = PaginatedResponse.fromJson(results[0], Task.fromJson);
      final projectPage = PaginatedResponse.fromJson(results[1], Project.fromJson);
      setState(() {
        _myTasks = taskPage.data.where((t) => t.assigneeUserIds.contains(myUserId)).toList();
        _projectNames = {for (final p in projectPage.data) p.id: p.name};
      });
    } on ApiException catch (e) {
      setState(() => _errorMessage = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changeStatus(Task task, TaskStatus toStatus) async {
    setState(() => _updatingTaskId = task.id);
    try {
      await widget.apiClient.patch('/tasks/${task.id}/status', {'status': taskStatusToJson(toStatus)});
      await _load();
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _updatingTaskId = null);
    }
  }

  Color _statusColor(TaskStatus status) {
    switch (status) {
      case TaskStatus.todo:
        return Colors.grey;
      case TaskStatus.doing:
        return Colors.blue;
      case TaskStatus.done:
        return Colors.green;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Công việc')),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_errorMessage != null) Text(_errorMessage!, style: const TextStyle(color: Colors.red)),
                  if (_myTasks.isEmpty) const Text('Bạn chưa được giao công việc nào'),
                  ..._myTasks.map((task) {
                    final nextStatuses = taskStatusTransitions[task.status] ?? [];
                    return Card(
                      child: ListTile(
                        title: Text(task.title),
                        subtitle: Text(_projectNames[task.projectId] ?? 'Dự án không xác định'),
                        trailing: _updatingTaskId == task.id
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : PopupMenuButton<TaskStatus>(
                                enabled: nextStatuses.isNotEmpty,
                                onSelected: (status) => _changeStatus(task, status),
                                itemBuilder: (context) => nextStatuses
                                    .map((s) => PopupMenuItem(value: s, child: Text('Chuyển sang: ${taskStatusLabelVi(s)}')))
                                    .toList(),
                                child: Chip(
                                  label: Text(taskStatusLabelVi(task.status)),
                                  backgroundColor: _statusColor(task.status).withValues(alpha: 0.15),
                                  labelStyle: TextStyle(color: _statusColor(task.status)),
                                ),
                              ),
                      ),
                    );
                  }),
                ],
              ),
      ),
    );
  }
}
