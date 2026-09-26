# 1. About the demo data :
## Org-admin will be in charged of Demo Data
```
Demo Data Management

Current scenario:
[ Project Delay ▼ ]

[Generate New Scenario]

Available scenarios:

○ Healthy Organization
○ Project Delay
○ Sales Decline
○ HR Risk
○ High Workload
○ Mixed Crisis

Seed:
[ 20260924 ]

[Generate]
```
After that the system will create the **all the important datas at once**

### For example : 
* When select "Project Delay"
Then :
```
Projects
    ↓
Tasks
    ↓
Employees
    ↓
Workload
    ↓
Attendance
    ↓
Progress
```
will all be generated in sync.

* Everytime generate will also had :
```
Scenario = Project Delay
Seed = 20260924
```
--> This will make sure the result is reproducible

# 2. About the Analytics module :
We will make this module into 6 layers as follow :
## 2.1. Layer 1 : Descriptive Analytics
This is our current had layer. Which answer the question : **"What happened?"**

* For example :
```
Projects = 5
Average completion = 32%
New documents = 36
Revenue = 318M
```

## 2.2. Layer 2 : Diagnostic Analytics
Which answer **"Why did it happen?"**
* Examples : 
```
Completion = 32%

Why?

Department:
Sales       4%
Docker     12%
Company    27%
CRM        40%
```

Then drill-down :
```
Sales = 4%

        ↓

23 tasks
        ↓

22 unfinished
        ↓

14 overdue
        ↓

9 assigned to 1 employee
```

We can let the user click on **"Tại sao kinh doanh chỉ đạt 4%"** then the system will automatically drill-down. 

## 2.3. Layer 3 : Anomaly Detection
We use ML/Statistics to detect anomalies. A simple option to do this is **Isolation Forest** in scikit-learn.

here's the link for Isolation Forest : https://github.com/scikit-learn/scikit-learn/blob/main/sklearn/ensemble/_iforest.py?

* Examples :
```
⚠ Bất thường được phát hiện

Employee #103
Attendance: 62%
↓
Team average: 94%

Task completion:
18%
↓
Team average: 51%

Overdue:
+340%
```

## 2.4. Layer 4 : Predictive Analytics
* Examples :

**Project**
```
Current progress: 32%

Predicted completion:
████████████░░░░░░░░ 58%

Expected delay:
+11 days
```

or 

**Revenue**
```
Current revenue
318M

Next 30 days forecast
347M – 369M
```

or

**Employee workload**
```
Employee A

Current workload: 87%

Predicted overdue risk: HIGH
```

for this one, we can use NeuralForecast library. 

## 2.5. Layer 5 : Recommendation Engine
After found out :
```
Problem
+
Root Cause
+
Prediction
```

we will call Gemini.

* examples:
```json
{
  "problem": "PROJECT_DELAY",
  "severity": "HIGH",
  "completion": 0.32,
  "overdue_tasks": 14,
  "workload_imbalance": 0.71,
  "predicted_delay_days": 11
}
```
Gemini will received **structured data**, not all the database.

And return :
```json
{
  "summary": "...",
  "recommendations": [
    {
      "action": "...",
      "priority": "HIGH",
      "reason": "...",
      "expected_effect": "...",
      "effort": "LOW"
    }
  ]
}
```
after that frontend will render them into UI.

## 2.6. Layer 6 : What-if Simulation
This one is a **recommend** function.
* examples :
```
Nếu chuyển 2 nhân viên từ Project A sang Project B thì sao?
```
or 
```
Nếu giảm 20% task overdue thì completion rate thay đổi thế nào?
```

UI will be as follow :
```
              WHAT-IF SIMULATION

Current
Project completion      32%
Overdue                 14
Workload                87%

Scenario
────────────────────────────
Reassign employees       [-2]
Reduce overdue tasks     [-20%]

             [SIMULATE]

Result
────────────────────────────
Expected completion      46%
Expected overdue          9
Workload                 74%
```

* **Remember** : this is a simulation base on theories of the system, not an absolute result.

# 3. The architecture will be using now :
I think the architecture will be as follow :
## **Hybrid AI Architecture**
```
                 ENTERPRISE DATABASE
                         │
                         ▼
                  Data Warehouse
                         │
             ┌───────────┼───────────┐
             │           │           │
             ▼           ▼           ▼
         Statistics    ML Models   Time Series
             │           │           │
             │           │           │
             └───────────┼───────────┘
                         ▼
                  Insight Engine
                         │
                         ▼
                     Gemini
                         │
                         ▼
               Recommendation Engine
                         │
                         ▼
                   Dashboard
```

# 4. Wireframe of the function
```
┌─────────────────────────────────────────────┐
│         ENTERPRISE INTELLIGENCE             │
├─────────────────────────────────────────────┤
│                                             │
│  1. 📊 Business Overview                    │
│     What happened?                          │
│                                             │
│  2. 🔎 Root Cause Analysis                  │
│     Why did it happen?                     │
│                                             │
│  3. ⚠ Anomaly & Risk Detection              │
│     What is unusual/risky?                 │
│                                             │
│  4. 🔮 Forecasting                          │
│     What may happen next?                  │
│                                             │
│  5. 🤖 AI Action Plan                       │
│     What can we do about it?               │
│                                             │
│  6. 🧪 What-if Simulation                   │
│     What if we change X?                   │
│                                             │
└─────────────────────────────────────────────┘
```
Only for reference, don't use this.

# 5. AI/Data analysis system structure
```
                    DATABASE
                       │
                       ▼
               ┌───────────────┐
               │ Data Pipeline │
               └───────┬───────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
        KPI Engine          Feature Engine
              │                 │
              ▼                 ▼
       Statistical          ML Models
        Analysis        ┌──────┼───────┐
                        │      │       │
                       Risk  Anomaly Forecast
                        │      │       │
                        └──────┼───────┘
                               ▼
                       Insight Engine
                               │
                               ▼
                         Gemini API
                               │
                  ┌────────────┴───────────┐
                  ▼                        ▼
             Explanation            Action Plan
                  │                        │
                  └────────────┬───────────┘
                               ▼
                       React Dashboard
```
