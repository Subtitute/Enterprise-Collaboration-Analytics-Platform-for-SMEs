/// Khop voi TaskStatus (packages/common-dto/src/enums/task-status.enum.ts) va
/// TASK_STATUS_TRANSITIONS cung file - Kanban chi co 3 cot, khong dung Kanban keo-tha tren
/// dien thoai (Doc/ECAP_Mobile.md muc 12) nen chi can enum + bang chuyen trang thai hop le.
enum TaskStatus { todo, doing, done }

TaskStatus taskStatusFromJson(String raw) {
  switch (raw) {
    case 'DOING':
      return TaskStatus.doing;
    case 'DONE':
      return TaskStatus.done;
    default:
      return TaskStatus.todo;
  }
}

String taskStatusToJson(TaskStatus status) {
  switch (status) {
    case TaskStatus.todo:
      return 'TODO';
    case TaskStatus.doing:
      return 'DOING';
    case TaskStatus.done:
      return 'DONE';
  }
}

String taskStatusLabelVi(TaskStatus status) {
  switch (status) {
    case TaskStatus.todo:
      return 'Cần làm';
    case TaskStatus.doing:
      return 'Đang làm';
    case TaskStatus.done:
      return 'Hoàn thành';
  }
}

/// Ban sao cua TASK_STATUS_TRANSITIONS (backend) - danh sach trang thai KE TIEP hop le tu 1
/// trang thai hien tai, dung de chi hien nut doi trang thai hop le tren giao dien.
const Map<TaskStatus, List<TaskStatus>> taskStatusTransitions = {
  TaskStatus.todo: [TaskStatus.doing],
  TaskStatus.doing: [TaskStatus.todo, TaskStatus.done],
  TaskStatus.done: [TaskStatus.doing],
};

/// Khop voi TaskWithAssignees (apps/project-task-service/src/tasks/tasks.service.ts) - response
/// cua GET /tasks. `assignees` chi co `userId` (khong co fullName/email - User o DB rieng cua
/// IAM Service, khong the JOIN xuyen service, giong han che da ghi nhan o web).
class Task {
  final String id;
  final String projectId;
  final String title;
  final String? description;
  final TaskStatus status;
  final String? dueDate;
  final List<String> assigneeUserIds;

  Task({
    required this.id,
    required this.projectId,
    required this.title,
    required this.description,
    required this.status,
    required this.dueDate,
    required this.assigneeUserIds,
  });

  factory Task.fromJson(Map<String, dynamic> json) {
    final assignees = (json['assignees'] as List<dynamic>? ?? [])
        .map((a) => (a as Map<String, dynamic>)['userId'] as String)
        .toList();
    return Task(
      id: json['id'] as String,
      projectId: json['projectId'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      status: taskStatusFromJson(json['status'] as String),
      dueDate: json['dueDate'] as String?,
      assigneeUserIds: assignees,
    );
  }
}
