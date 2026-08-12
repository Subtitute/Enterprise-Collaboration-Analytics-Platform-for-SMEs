/// Chi doc ten du an de hien thi tren the Cong viec (Task chi co `projectId`, khong kem ten) -
/// khop toi thieu voi entity Project (apps/project-task-service/src/entities/project.entity.ts).
class Project {
  final String id;
  final String name;

  Project({required this.id, required this.name});

  factory Project.fromJson(Map<String, dynamic> json) {
    return Project(id: json['id'] as String, name: json['name'] as String);
  }
}
