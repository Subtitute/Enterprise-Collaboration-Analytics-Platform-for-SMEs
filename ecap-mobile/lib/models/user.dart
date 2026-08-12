/// Khop voi toPublicUser() cua AuthService (apps/iam-service) - khong bao gio co passwordHash.
class AppUser {
  final String id;
  final String email;
  final String fullName;
  final String organizationId;
  final String? departmentId;
  final List<String> roleNames;

  AppUser({
    required this.id,
    required this.email,
    required this.fullName,
    required this.organizationId,
    required this.departmentId,
    required this.roleNames,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    final roles = (json['roles'] as List<dynamic>? ?? [])
        .map((r) => (r as Map<String, dynamic>)['name'] as String)
        .toList();
    return AppUser(
      id: json['id'] as String,
      email: json['email'] as String,
      fullName: json['fullName'] as String,
      organizationId: json['organizationId'] as String,
      departmentId: json['departmentId'] as String?,
      roleNames: roles,
    );
  }
}
