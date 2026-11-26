import {
  CourseEnrollment,
  EnrollmentStatus,
  Student,
} from '../entities';
import { AppError } from '../middlewares/errorHandler';
import {
  BulkCreateStudentsInput,
  CreateStudentInput,
  UpdateEnrollmentInput,
} from '../schemas/students.schema';
import { CoursesService } from './courses.service';
import { getEm } from './em';

export class StudentsService {
  static async listCourseStudents(userId: string, courseId: string) {
    const em = getEm();
    await CoursesService.verifyCourseTeacher(userId, courseId);

    const enrollments = await em.find(
      CourseEnrollment,
      { course: courseId },
      {
        populate: ['student'],
        orderBy: {
          student: {
            lastName: 'ASC',
            firstName: 'ASC',
          },
        },
      }
    );

    return enrollments;
  }

  static async enrollStudent(
    userId: string,
    courseId: string,
    input: CreateStudentInput
  ) {
    const em = getEm();
    const course = await CoursesService.verifyCourseTeacher(userId, courseId);

    return em.transactional(async (txEm) => {
      let student: Student | null = null;

      if (input.dni) {
        student = await txEm.findOne(Student, {
          school: course.school.id,
          dni: input.dni,
        });
      }

      if (student) {
        const existingEnrollment = await txEm.findOne(CourseEnrollment, {
          course: course.id,
          student: student.id,
        });

        if (existingEnrollment) {
          throw new AppError(
            409,
            'El alumno ya se encuentra inscripto en este curso'
          );
        }
      } else {
        student = txEm.create(Student, {
          school: course.school,
          firstName: input.firstName,
          lastName: input.lastName,
          dni: input.dni ?? null,
          createdAt: new Date(),
        });
        txEm.persist(student);
      }

      const enrollment = txEm.create(CourseEnrollment, {
        course,
        student,
        status: EnrollmentStatus.ACTIVE,
        enrolledAt: new Date(),
      });

      await txEm.persistAndFlush(enrollment);
      return enrollment;
    });
  }

  static async bulkEnrollStudents(
    userId: string,
    courseId: string,
    rawInput: BulkCreateStudentsInput
  ) {
    const em = getEm();
    const course = await CoursesService.verifyCourseTeacher(userId, courseId);
    const studentsInput = Array.isArray(rawInput)
      ? rawInput
      : rawInput.students;

    return em.transactional(async (txEm) => {
      const enrollments: CourseEnrollment[] = [];

      for (const item of studentsInput) {
        let student: Student | null = null;

        if (item.dni) {
          student = await txEm.findOne(Student, {
            school: course.school.id,
            dni: item.dni,
          });
        }

        if (!student) {
          student = txEm.create(Student, {
            school: course.school,
            firstName: item.firstName,
            lastName: item.lastName,
            dni: item.dni ?? null,
            createdAt: new Date(),
          });
          txEm.persist(student);
        }

        let enrollment = student.id
          ? await txEm.findOne(CourseEnrollment, {
              course: course.id,
              student: student.id,
            })
          : null;

        if (!enrollment) {
          enrollment = txEm.create(CourseEnrollment, {
            course,
            student,
            status: EnrollmentStatus.ACTIVE,
            enrolledAt: new Date(),
          });
          txEm.persist(enrollment);
        }

        enrollments.push(enrollment);
      }

      await txEm.flush();

      return enrollments.sort((a, b) => {
        const lastCmp = a.student.lastName.localeCompare(b.student.lastName);
        if (lastCmp !== 0) return lastCmp;
        return a.student.firstName.localeCompare(b.student.firstName);
      });
    });
  }

  static async updateEnrollment(
    userId: string,
    enrollmentId: string,
    input: UpdateEnrollmentInput
  ) {
    const em = getEm();

    const enrollment = await em.findOne(
      CourseEnrollment,
      { id: enrollmentId },
      {
        populate: [
          'student',
          'course',
          'course.teacher',
          'course.teacher.user',
        ],
      }
    );

    if (!enrollment) {
      throw new AppError(404, 'Inscripción no encontrada');
    }

    if (enrollment.course.teacher.user.id !== userId) {
      throw new AppError(
        403,
        'No tienes permisos para modificar esta inscripción'
      );
    }

    if (input.firstName !== undefined) {
      enrollment.student.firstName = input.firstName;
    }
    if (input.lastName !== undefined) {
      enrollment.student.lastName = input.lastName;
    }
    if (input.dni !== undefined) {
      enrollment.student.dni = input.dni;
    }
    if (input.status !== undefined) {
      enrollment.status = input.status;
    }

    await em.flush();
    return enrollment;
  }
}
